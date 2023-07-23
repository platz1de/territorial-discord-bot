import {EmbedBuilder, SlashCommandBuilder} from "discord.js";
import {Command, client} from "../PointManager";
import {format, formatTime} from "../util/EmbedUtil";
import {BotUserContext} from "../util/BotUserContext";

export default {
	slashExclusive: false,
	stringyNames: ["about"],
	slashData: new SlashCommandBuilder().setName("about").setDescription("See infos about the bot"),
	execute: showAboutEmbed,
	executeStringy: showAboutEmbed
} as Command;

async function showAboutEmbed(context: BotUserContext) {
	const totalData = await context.getTotalData();
	context.reply({
		embeds: [
			new EmbedBuilder().setAuthor({name: client.user?.tag ?? "Unknown", iconURL: client.user?.displayAvatarURL()})
				.setFields(
					{name: "Stats", value: `Tracking ${format(await context.getAllTimeEntryCount())} members totalling ${format(totalData.points)} points with ${format(totalData.wins)} wins`},
					{name: "Commands", value: `Use </help:1129906100985151527> to see all commands`},
					{name: "Uptime", value: formatTime(Math.floor(process.uptime()))},
					{name: "Source", value: "https://github.com/territorialHQ/point-system-bot"},
					{name: "Support", value: "DM @platz1de for now (ONLY IF YOU HAVE A GOOD REASON)"}
				).setFooter({text: "Made with ❤️ by the TTHQ Team"}).toJSON()
		]
	}).catch(console.error);
}