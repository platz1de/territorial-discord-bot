import {ActionRowBuilder, ButtonBuilder, ButtonInteraction, ButtonStyle, ChatInputCommandInteraction, Colors, EmbedBuilder, Message, SlashCommandBuilder} from "discord.js";
import {Command} from "../PointManager";
import {format} from "../util/EmbedUtil";
import {BotUserContext} from "../util/BotUserContext";

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
	execute: async (context: BotUserContext) => {
		const interaction = context.base as ChatInputCommandInteraction;
		let page: number = interaction.options.getInteger("page") || 1;
		const type: number = interaction.options.getInteger("type") || 0;
		await buildLeaderboardPage(context, page, type === 1, -1);
	},
	executeStringy: async (context: BotUserContext) => {
		const message = context.base as Message;
		if (message.content.split(" ").length > 1) {
			if (message.content.split(" ")[1].slice(-1) === "d") {
				await buildLeaderboardPage(context, 1, false, Math.max(1, Math.min(parseInt(message.content.split(" ")[1].slice(0, -1)), 30)));
				return;
			}
		}
		await buildLeaderboardPage(context, 1, false, -1);
	}
} as Command;

async function buildLeaderboardPage(context: BotUserContext, page: number, wins: boolean, duration: number) {
	if (isNaN(duration)) duration = 7;
	const max: number = Math.ceil(await (duration === -1 ? context.getAllTimeEntryCount() : context.getDailyEntryCount(duration)) / 10);
	page = Math.max(1, Math.min(page, max));
	const leaderboard = await (duration === -1 ? context.getAllTimeLeaderboard(wins, page) : context.getDailyLeaderboard(wins, duration, page));
	const msg = await context.reply({
		embeds: [new EmbedBuilder().setColor(Colors.Blurple)
			.setAuthor({name: `Leaderboard ${duration === -1 ? `of ${context.guild.name}` : `for last ${duration} days`}`, iconURL: context.guild.iconURL() || undefined})
			.setDescription(`Showing ${wins ? "wins 🏅" : "points 🏆"}\n⠀\n` + leaderboard.map((entry: any, index: number) => `${(page - 1) * 10 + index + 1}. <@${entry.member}> • ${format(entry.value)}`).join("\n"))
			.setFooter({text: `Page ${page}/${max}`}).toJSON()
		],
		components: [
			new ActionRowBuilder<ButtonBuilder>().addComponents(
				new ButtonBuilder().setCustomId("previous").setEmoji("⬅").setStyle(ButtonStyle.Primary).setDisabled(page === 1),
				new ButtonBuilder().setCustomId("mode").setEmoji(wins ? "🏅" : "🏆").setStyle(ButtonStyle.Secondary),
				new ButtonBuilder().setCustomId("next").setEmoji("➡").setStyle(ButtonStyle.Primary).setDisabled(page === max)
			)
		]
	});

	if (!context.channel) return;
	const collector = context.channel.createMessageComponentCollector({time: 60000});
	collector.on("collect", async i => {
		try {
			if (i instanceof ButtonInteraction) {
				if (i.message.id !== msg.id || i.user.id !== context.user.id) return;
				await i.deferUpdate();
				switch (i.customId) {
					case "previous":
						page--;
						break;
					case "next":
						page++;
						break;
					case "mode":
						wins = !wins;
						break;
				}
			} else {
				return;
			}
			collector.stop();
			await buildLeaderboardPage(context, page, wins, duration);
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