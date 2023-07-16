import {ChatInputCommandInteraction, Colors, EmbedBuilder, Message, SlashCommandBuilder} from "discord.js";
import {rewards} from "../PointManager";
import BotInteraction from "../util/BotInteraction";
import {Reward} from "../util/RewardManager";
import {ServerSetting} from "../BotSettingProvider";

export default {
	slashExclusive: false,
	stringyNames: ["roles", "promotions", "rankups", "rewards"],
	slashData: new SlashCommandBuilder().setName("roles").setDescription("See a list off all available role rewards"),
	execute: async (setting: ServerSetting, interaction: ChatInputCommandInteraction) => {
		await showRoleEmbed(setting, new BotInteraction(interaction));
	},
	executeStringy: async (setting: ServerSetting, message: Message) => {
		await showRoleEmbed(setting, new BotInteraction(message));
	}
}

async function showRoleEmbed(setting: ServerSetting, interaction: BotInteraction) {
	const roles: Reward[] = rewards.getRewardList(setting);
	await interaction.reply({
		embeds: [
			new EmbedBuilder().setAuthor({name: `Available reward roles`, iconURL: interaction.guild.iconURL() || undefined})
				.setDescription(roles.map(role => `<@&${role.role_id}> • Reach ${role.count} ${role.type}`).join("\n")
				).setColor(Colors.Blurple).setTimestamp().toJSON()
		]
	});
}