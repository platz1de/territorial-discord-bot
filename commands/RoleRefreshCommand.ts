import {ChatInputCommandInteraction, GuildMember, PermissionFlagsBits, SlashCommandBuilder} from "discord.js";
import {rewards} from "../PointManager";
import {Reward} from "../util/RewardManager";
import {ServerSetting} from "../BotSettingProvider";

export default {
	slashExclusive: true,
	stringyNames: [],
	slashData: new SlashCommandBuilder().setName("rolerefresh").setDescription("Refresh the role rewards")
		.addUserOption(option => option.setName("member").setDescription("The member to refresh roles from").setRequired(true))
		.setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),
	execute: async (setting: ServerSetting, interaction: ChatInputCommandInteraction) => {
		const member = interaction.options.getMember("member");
		if (!(member instanceof GuildMember)) return;
		const eligible: Reward[] = await rewards.calculateEligibleRoles(setting, member);
		if (setting.roles === "highest") {
			const filtered = rewards.filterByHierarchy(eligible);
			if (filtered.length > 0) {
				const remove = [];
				for (const role of eligible) {
					if (!filtered.includes(role)) {
						remove.push(role.role_id);
					}
				}
				member.roles.remove(remove, "Refreshed roles").catch();
			}
		} else {
			member.roles.add(eligible.map(r => r.role_id), "Refreshed roles").catch();
		}
		await interaction.editReply("Roles refreshed");
	}
}