import {ChatInputCommandInteraction, Colors, EmbedBuilder, SlashCommandBuilder} from "discord.js";
import {PointCommand, rewards} from "../PointManager.js";
import {Reward} from "../util/RewardManager.js";
import {ServerContext} from "../util/ServerContext.js";

export default {
	slashData: new SlashCommandBuilder().setName("roles").setDescription("See a list off all available role rewards"),
	execute: async (interaction: ChatInputCommandInteraction, context: ServerContext) => {
		const roles: Reward[] = rewards.getRewardList(context.guild);
		await interaction.editReply({
			embeds: [
				new EmbedBuilder().setAuthor({name: `Available reward roles`, iconURL: context.guild.iconURL() || undefined})
					.setDescription(roles.length === 0 ? "None" : roles.map(role => `<@&${role.role_id}> • Reach ${role.count} ${role.type}`).join("\n")
					).setColor(Colors.Blurple).setTimestamp().toJSON()
			]
		});
	}
} as PointCommand;