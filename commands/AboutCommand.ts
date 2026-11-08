import {ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder} from "discord.js";
import {client, GenericCommand, getCommandId} from "../PointManager.js";
import {format, formatTime} from "../util/EmbedUtil.js";
import {BaseUserContext} from "../util/BaseUserContext.js";

export default {
	slashData: new SlashCommandBuilder().setName("about").setDescription("See infos about the bot"),
	execute: async (context: BaseUserContext) => {
		const interaction = context.base as ChatInputCommandInteraction;
		const totalData = context.getTotalData();
		interaction.editReply({
			embeds: [
				new EmbedBuilder().setAuthor({name: client.user?.tag ?? "Unknown", iconURL: client.user?.displayAvatarURL()})
					.setFields(
						{name: "Stats", value: `Tracking ${format(context.getAllTimeEntryCount())} members totalling ${format(totalData.points)} points with ${format(totalData.wins)} wins`},
						{name: "Commands", value: `Use </help:${getCommandId("help")}> to see all commands`},
						{name: "Uptime", value: formatTime(Math.floor(process.uptime()))},
						{name: "Source", value: "https://github.com/platz1de/territorial-discord-bot"},
						{name: "TOS", value: "https://platz1de.github.io/TTHQ/ps-tos"},
						{name: "Privacy Policy", value: "https://platz1de.github.io/TTHQ/ps-privacy"},
						{name: "Support", value: "https://discord.gg/tvgfpeCGaD"}
					).setFooter({text: "Made with ❤️ by platz1de"}).toJSON()
			]
		}).catch(console.error);
	}
} as GenericCommand;