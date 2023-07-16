import {ChatInputCommandInteraction, EmbedBuilder, Message, SlashCommandBuilder} from "discord.js";
import {db} from "../PointManager";
import BotInteraction from "../util/BotInteraction";
import {format, formatTime} from "../util/EmbedUtil";
import {ServerSetting} from "../BotSettingProvider";

export default {
	slashExclusive: false,
	stringyNames: ["about"],
	slashData: new SlashCommandBuilder().setName("about").setDescription("See infos about the bot"),
	execute: async (setting: ServerSetting, interaction: ChatInputCommandInteraction) => {
		await showAboutEmbed(setting, new BotInteraction(interaction));
	},
	executeStringy: async (setting: ServerSetting, message: Message) => {
		await showAboutEmbed(setting, new BotInteraction(message));
	}
}

async function showAboutEmbed(setting: ServerSetting, interaction: BotInteraction) {
	const totalData = await db.getGlobalProvider().getTotalData(setting);
	await interaction.reply({
		embeds: [
			new EmbedBuilder().setAuthor({name: interaction.client.user?.tag ?? "Unknown", iconURL: interaction.client.user?.displayAvatarURL()})
				.setFields(
					{name: "Stats", value: `Tracking ${format(await db.getGlobalProvider().getEntryCount(setting))} members totalling ${format(totalData.points)} points with ${format(totalData.wins)} wins`},
					{name: "Commands", value: `Use </help:1129906100985151527> to see all commands`},
					{name: "Uptime", value: formatTime(Math.floor(process.uptime()))},
					{name: "Source", value: "https://github.com/territorialHQ/point-system-bot"},
				).setFooter({text: "Made with ❤️ by the TTHQ Team"}).toJSON()
		]
	});
}