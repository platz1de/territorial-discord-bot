import {ActionRowBuilder, ButtonBuilder, ButtonInteraction, ButtonStyle, ChatInputCommandInteraction, Colors, EmbedBuilder, Message, SlashCommandBuilder} from "discord.js";
import {db} from "../PointManager";
import BotInteraction from "../util/BotInteraction";
import {format} from "../util/EmbedUtil";
import {ServerSetting} from "../BotSettingProvider";

export default {
	slashExclusive: false,
	stringyNames: ["leaderboard", "lb", "top"],
	slashData: {
		name: "leaderboard",
		toJSON: function () {
			return new SlashCommandBuilder().setName("leaderboard").setDescription("Show the leaderboard")
				.addIntegerOption(option => option.setName("page").setDescription("The page to view"))
				.addIntegerOption(option => option.setName("type").setDescription("Type of leaderboard").addChoices(
					{name: "Points", value: 0},
					{name: "Wins", value: 1}
				))
		}
	},
	execute: async (setting: ServerSetting, interaction: ChatInputCommandInteraction) => {
		let page: number = interaction.options.getInteger("page") || 1;
		const type: number = interaction.options.getInteger("type") || 0;
		await buildLeaderboardPage(setting, new BotInteraction(interaction), page, type);
	},
	executeStringy: async (setting: ServerSetting, message: Message) => {
		if (message.content.split(" ").length > 1) {
			if (message.content.split(" ")[1].slice(-1) === "d") {
				await buildDailyLeaderboardPage(setting, new BotInteraction(message), 1, 0, parseInt(message.content.split(" ")[1].slice(0, -1)));
				return;
			}
		}
		await buildLeaderboardPage(setting, new BotInteraction(message), 1, 0);
	}
}

async function buildLeaderboardPage(setting: ServerSetting, interaction: BotInteraction, page: number, type: number) {
	const provider = db.getGlobalProvider();
	const max: number = Math.ceil(await provider.getEntryCount(setting) / 10);
	page = Math.max(1, Math.min(page, max));
	const leaderboard = type === 0 ? await provider.getPointLeaderboard(setting, page) : await provider.getWinLeaderboard(setting, page);
	const msg = await interaction.reply({
		embeds: [new EmbedBuilder().setColor(Colors.Blurple)
			.setAuthor({name: `Leaderboard of ${interaction.guild.name}`, iconURL: interaction.guild.iconURL() || undefined})
			.setDescription(`Showing ${type === 0 ? "points 🏆" : "wins 🏅"}\n⠀\n` + leaderboard.map((entry: any, index: number) => `${(page - 1) * 10 + index + 1}. <@${entry.member}> • ${format(type === 0 ? entry.points : entry.wins)}`).join("\n"))
			.setFooter({text: `Page ${page}/${max}`}).toJSON()
		],
		components: [
			new ActionRowBuilder<ButtonBuilder>().addComponents(
				new ButtonBuilder().setCustomId("previous").setEmoji("⬅").setStyle(ButtonStyle.Primary).setDisabled(page === 1),
				new ButtonBuilder().setCustomId("mode").setEmoji(type === 1 ? "🏆" : "🏅").setStyle(ButtonStyle.Secondary),
				new ButtonBuilder().setCustomId("next").setEmoji("➡").setStyle(ButtonStyle.Primary).setDisabled(page === max)
			)
		]
	});

	const collector = interaction.channel.createMessageComponentCollector({time: 60000});
	collector.on("collect", async i => {
		try {
			if (i instanceof ButtonInteraction) {
				if (i.message.id !== msg.id || i.user.id !== interaction.user.id) return;
				await i.deferUpdate();
				switch (i.customId) {
					case "previous":
						page--;
						break;
					case "next":
						page++;
						break;
					case "mode":
						type = type === 0 ? 1 : 0;
						break;
				}
			} else {
				return;
			}
			collector.stop();
			await buildLeaderboardPage(setting, interaction, page, type);
		} catch (e) {
			console.log(e);
		}
	});

	collector.on("end", async (collected, reason) => {
		try {
			reason === "time" && await msg.edit({components: []})
		} catch (e) {
		}
	});
}

async function buildDailyLeaderboardPage(setting: ServerSetting, interaction: BotInteraction, page: number, type: number, duration: number) {
	if (isNaN(duration)) duration = 7;
	duration = Math.max(1, Math.min(duration, 30));
	const provider = db.getDailyProvider();
	const max: number = Math.ceil(await provider.getEntryCount(setting, duration) / 10);
	page = Math.max(1, Math.min(page, max));
	const leaderboard = type === 0 ? await provider.getPointLeaderboard(setting, duration, page) : await provider.getWinLeaderboard(setting, duration, page);
	const msg = await interaction.reply({
		embeds: [new EmbedBuilder().setColor(Colors.Blurple)
			.setAuthor({name: `Leaderboard for last ${duration} days`, iconURL: interaction.guild.iconURL() || undefined})
			.setDescription(`Showing ${type === 0 ? "points 🏆" : "wins 🏅"}\n⠀\n` + leaderboard.map((entry: any, index: number) => `${(page - 1) * 10 + index + 1}. <@${entry.member}> • ${format(type === 0 ? entry.points : entry.wins)}`).join("\n"))
			.setFooter({text: `Page ${page}/${max}`}).toJSON()
		],
		components: [
			new ActionRowBuilder<ButtonBuilder>().addComponents(
				new ButtonBuilder().setCustomId("previous").setEmoji("⬅").setStyle(ButtonStyle.Primary).setDisabled(page === 1),
				new ButtonBuilder().setCustomId("mode").setEmoji(type === 1 ? "🏆" : "🏅").setStyle(ButtonStyle.Secondary),
				new ButtonBuilder().setCustomId("next").setEmoji("➡").setStyle(ButtonStyle.Primary).setDisabled(page === max)
			)
		]
	});

	const collector = interaction.channel.createMessageComponentCollector({time: 60000});
	collector.on("collect", async i => {
		try {
			if (i instanceof ButtonInteraction) {
				if (i.message.id !== msg.id || i.user.id !== interaction.user.id) return;
				await i.deferUpdate();
				switch (i.customId) {
					case "previous":
						page--;
						break;
					case "next":
						page++;
						break;
					case "mode":
						type = type === 0 ? 1 : 0;
						break;
				}
			}
			collector.stop();
			await buildDailyLeaderboardPage(setting, interaction, page, type, duration);
		} catch (e) {
			console.log(e);
		}
	});

	collector.on("end", async (collected, reason) => {
		try {
			reason === "time" && await msg.edit({components: []})
		} catch (e) {
		}
	});
}