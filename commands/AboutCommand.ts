import {ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder} from "discord.js";
import {client, GenericCommand, getCommandId} from "../PointManager.js";
import {format, formatTime} from "../util/EmbedUtil.js";
import {db} from "../db/DataBaseManager.js";

export default {
	slashData: new SlashCommandBuilder().setName("about").setDescription("See infos about the bot"),
	execute: async (interaction: ChatInputCommandInteraction) => {
		let fields = [];
		if (interaction.guildId) {
			const entrySum = db.total.entrySum({guild: interaction.guildId});
			const entryCount = db.total.entryCount({guild: interaction.guildId});
			fields.push({name: "Stats", value: `Tracking ${format(entryCount)} members totalling ${format(entrySum.points)} points with ${format(entrySum.wins)} wins`});
		}
		fields.push({name: "Commands", value: `Use </help:${getCommandId("help")}> to see all commands`});
		fields.push({name: "Uptime", value: formatTime(Math.floor(process.uptime()))});
		fields.push({name: "Source", value: "https://github.com/platz1de/territorial-discord-bot"});
		fields.push({name: "TOS", value: "https://platz1de.github.io/TTHQ/ps-tos"});
		fields.push({name: "Privacy Policy", value: "https://platz1de.github.io/TTHQ/ps-privacy"});
		fields.push({name: "Support", value: "https://discord.gg/tvgfpeCGaD"});
		interaction.editReply({
			embeds: [
				new EmbedBuilder().setAuthor({name: client.user?.tag ?? "Unknown", iconURL: client.user?.displayAvatarURL()})
					.setFields(fields).setFooter({text: "Made with ❤️ by platz1de"}).toJSON()
			]
		}).catch(console.error);
	}
} as GenericCommand;