import {EmbedBuilder, SlashCommandBuilder} from "discord.js";
import {client, GenericCommand, getCommandId} from "../PointManager";
import {format, formatTime} from "../util/EmbedUtil";
import {BaseUserContext} from "../util/BaseUserContext";

export default {
	slashData: new SlashCommandBuilder().setName("about").setDescription("See infos about the bot"),
	execute: async (context: BaseUserContext) => {
		const totalData = await context.getTotalData();
		context.reply({
			embeds: [
				new EmbedBuilder().setAuthor({name: client.user?.tag ?? "Unknown", iconURL: client.user?.displayAvatarURL()})
					.setFields(
						{name: "Stats", value: `Tracking ${format(await context.getAllTimeEntryCount())} members totalling ${format(totalData.points)} points with ${format(totalData.wins)} wins`},
						{name: "Commands", value: `Use </help:${getCommandId("help")}> to see all commands`},
						{name: "Uptime", value: formatTime(Math.floor(process.uptime()))},
						{name: "Source", value: "https://github.com/territorialHQ/point-system-bot"},
						{name: "TOS", value: "https://platz1de.github.io/TTHQ/ps-tos"},
						{name: "Privacy Policy", value: "https://platz1de.github.io/TTHQ/ps-privacy"},
						{name: "Support", value: "https://discord.gg/TtKJqYwfYe"}
					).setFooter({text: "Made with ❤️ by the TTHQ Team"}).toJSON()
			]
		}).catch(console.error);
	}
} as GenericCommand;