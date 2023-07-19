import {Colors, EmbedBuilder, SlashCommandBuilder} from "discord.js";
import {Command, rewards} from "../PointManager";
import {Reward} from "../util/RewardManager";
import {BotUserContext} from "../util/BotUserContext";

export default {
	slashExclusive: false,
	stringyNames: ["roles", "promotions", "rankups", "rewards"],
	slashData: new SlashCommandBuilder().setName("roles").setDescription("See a list off all available role rewards"),
	execute: showRoleEmbed,
	executeStringy: showRoleEmbed
} as Command;

async function showRoleEmbed(context: BotUserContext) {
	const roles: Reward[] = rewards.getRewardList(context);
	await context.reply({
		embeds: [
			new EmbedBuilder().setAuthor({name: `Available reward roles`, iconURL: context.guild.iconURL() || undefined})
				.setDescription(roles.length === 0 ? "None" : roles.map(role => `<@&${role.role_id}> • Reach ${role.count} ${role.type}`).join("\n")
				).setColor(Colors.Blurple).setTimestamp().toJSON()
		]
	});
}