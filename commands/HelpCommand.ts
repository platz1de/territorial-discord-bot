import {ButtonStyle, ChatInputCommandInteraction, EmbedBuilder, Message, SlashCommandBuilder} from "discord.js";
import {config} from "../PointManager";
import BotInteraction from "../util/BotInteraction";
import {ServerSetting} from "../BotSettingProvider";

export default {
	slashExclusive: false,
	stringyNames: ["help", "commands", "cmds", "cmd", "command"],
	slashData: new SlashCommandBuilder().setName("help").setDescription("See a command list"),
	execute: async (setting: ServerSetting, interaction: ChatInputCommandInteraction) => {
		await showHelpEmbed(setting, new BotInteraction(interaction));
	},
	executeStringy: async (setting: ServerSetting, message: Message) => {
		await showHelpEmbed(setting, new BotInteraction(message));
	}
}

async function showHelpEmbed(setting: ServerSetting, interaction: BotInteraction) {
	const prefix = setting.prefix;
	await interaction.reply({
		embeds: [
			new EmbedBuilder().setAuthor({name: interaction.client.user?.tag ?? "Unknown", iconURL: interaction.client.user?.displayAvatarURL()})
				.setFields(
					{
						name: "General", value: `
**${prefix}add <points>** - Register a win for yourself
**${prefix}remove <points>** - Remove a win (if misadded)
**${prefix}profile [@user]** - See your or someone else's profile
**${prefix}lb** - See the leaderboard
**${prefix}lb 7d** - See the leaderboard for the last 7 days (available 1-30)
**${prefix}mult** - See the current multiplier (if any)
**${prefix}roles** - See all role rewards
**${prefix}help** - See this list
**${prefix}about** - See infos about the bot`
					},
					{
						name: "Moderation", value: `
</addwin:1129749479453642844> - Register a win for someone else
</removewin:1129749479453642845> - Remove a win from someone else
</modifypoints:1129749479453642846> - Modify a user's points or wins`
					},
					{
						name: "Admin", value: `
</multiplier set:1129749479642365993> - Set the current multiplier
</multiplier clear:1129749479642365993> - Remove the current multiplier
</multiplier setend:1129749479642365993> - Set the end date of the current multiplier
</settings show:1129906100985151524> - Change server settings`
					}
				).setTimestamp().toJSON()
		]
	});
}