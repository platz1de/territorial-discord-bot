import {ChatInputCommandInteraction, GuildMember, PermissionFlagsBits, SlashCommandBuilder} from "discord.js";
import {db, rewards} from "../PointManager";
import {Reward} from "../util/RewardManager";

export default {
	slashExclusive: true,
	stringyNames: [],
	slashData: new SlashCommandBuilder().setName("rolerefresh").setDescription("Refresh the role rewards")
		.addUserOption(option => option.setName("member").setDescription("The member to refresh roles from").setRequired(true))
		.setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),
	execute: async (interaction: ChatInputCommandInteraction) => {
		const member = interaction.options.getMember("member");
		if (!(member instanceof GuildMember)) return;
		const settings = db.getSettingProvider().getUserSetting(member.id);
		const eligible: Reward[] = await rewards.calculateEligibleRoles(member);
		if (settings.roles === "highest") {
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