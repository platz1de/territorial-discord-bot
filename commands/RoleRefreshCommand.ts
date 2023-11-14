import {ChatInputCommandInteraction, PermissionFlagsBits, SlashCommandBuilder} from "discord.js";
import {PointCommand, rewards} from "../PointManager";
import {Reward} from "../util/RewardManager";
import {BotUserContext, getRawUser} from "../util/BotUserContext";

export default {
	slashData: new SlashCommandBuilder().setName("rolerefresh").setDescription("Refresh the role rewards")
		.addUserOption(option => option.setName("member").setDescription("The member to refresh roles from").setRequired(true))
		.setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),
	execute: async (context: BotUserContext) => {
		const interaction = context.base as ChatInputCommandInteraction;
		const user = interaction.options.getUser("member", true);
		const member = await context.guild.members.fetch(user.id);
		const newContext = getRawUser(context.guild.id, user.id);
		if (!newContext || !member) {
			await interaction.editReply("Invalid member");
			return;
		}
		const eligible: Reward[] = await rewards.calculateEligibleRoles(context);
		if (context.context.roles === "highest") {
			const filtered = rewards.filterByHierarchy(eligible);
			if (filtered.length > 0) {
				const eligibleRoles = eligible.map(r => r.role_id);
				let newRoles = filtered.map(r => r.role_id);
				for (const role of member.roles.cache.values()) {
					if (!newRoles.includes(role.id) && !eligibleRoles.includes(role.id)) {
						newRoles.push(role.id);
					}
				}
				member.roles.set(newRoles, "Refreshed roles").catch(console.error);
			}
		} else {
			member.roles.add(eligible.map(r => r.role_id), "Refreshed roles").catch(console.error);
		}
		await context.reply("Roles refreshed");
	}
} as PointCommand;