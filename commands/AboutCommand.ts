import {ButtonStyle, ChatInputCommandInteraction, EmbedBuilder, Message, SlashCommandBuilder} from "discord.js";
import {db} from "../PointManager";
import BotInteraction from "../util/BotInteraction";
import {format, formatTime} from "../util/EmbedUtil";

export default {
	slashExclusive: false,
	stringyNames: ["about"],
	slashData: new SlashCommandBuilder().setName("about").setDescription("See infos about the bot"),
	execute: async (interaction: ChatInputCommandInteraction) => {
		await showAboutEmbed(new BotInteraction(interaction));
	},
	executeStringy: async (message: Message) => {
		await showAboutEmbed(new BotInteraction(message));
	}
}

async function showAboutEmbed(interaction: BotInteraction) {
	const totalData = await db.getGlobalProvider().getTotalData();
	await interaction.reply({
		embeds: [
			new EmbedBuilder().setAuthor({name: interaction.client.user?.tag ?? "Unknown", iconURL: interaction.client.user?.displayAvatarURL()})
				.setFields(
					{name: "Stats", value: `Tracking ${format(await db.getGlobalProvider().getEntryCount())} members over ${db.getCurrentSeasonNumber() + 1} seasons, totalling ${format(totalData.points)} points with ${format(totalData.wins)} wins\nGreat work 💪`},
					{name: "Commands", value: `Use </help:1059128936421920870> to see all commands`},
					{name: "Uptime", value: formatTime(Math.floor(process.uptime()))}
				).setFooter({text: "Made with ❤️ by platz1de (sdsd)"}).toJSON()
		]
	});
}