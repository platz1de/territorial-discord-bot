import {ActionRowBuilder, BaseMessageOptions, ButtonBuilder, ButtonInteraction, ButtonStyle, ChatInputCommandInteraction, Colors, EmbedBuilder, Message, SlashCommandBuilder, User} from "discord.js";
import {PointCommand} from "../PointManager.js";
import {format} from "../util/EmbedUtil.js";
import {buildMessageReplyContext} from "../util/InteractionContext.js";
import {ServerContext} from "../util/ServerContext.js";
import {db} from "../db/DataBaseManager.js";

export default {
	slashData: new SlashCommandBuilder().setName("leaderboard").setDescription("Show the leaderboard")
		.addIntegerOption(option => option.setName("page").setDescription("The page to view"))
		.addIntegerOption(option => option.setName("type").setDescription("Type of leaderboard").addChoices({name: "Points", value: 0}, {name: "Wins", value: 1}))
		.addIntegerOption(option => option.setName("duration").setDescription("The duration to view")),
	execute: async (interaction: ChatInputCommandInteraction, context: ServerContext) => {
		let page: number = interaction.options.getInteger("page") || 1;
		const type: number = interaction.options.getInteger("type") || 0;
		const duration: number = interaction.options.getInteger("duration") === null ? -1 : Math.max(0, Math.min(interaction.options.getInteger("duration") || 7, 30));
		await buildLeaderboardPage(context, interaction.user, page, type === 1, duration, interaction.editReply);
	}
} as PointCommand;

async function buildLeaderboardPage(context: ServerContext, user: User, page: number, wins: boolean, duration: number, reply: (content: BaseMessageOptions) => Promise<Message>) {
	if (isNaN(duration)) duration = 7;
	const provider = duration === -1 ? db.total : db.daily;
	const max: number = Math.ceil((provider.entryCount({guild: context.guild.id, duration})) / 10);
	page = Math.max(1, Math.min(page, max));
	const leaderboard = wins ? provider.leaderboard.wins({guild: context.guild.id, page, duration}) : provider.leaderboard.points({guild: context.guild.id, page, duration});
	let start = new Date(), end = new Date();
	if (duration !== -1) {
		start.setUTCHours(0, 0, 0, 0);
		start.setDate(start.getDate() - duration);
	}
	const msg = await reply({
		embeds: [new EmbedBuilder().setColor(Colors.Blurple)
			.setAuthor({name: `Leaderboard ${duration === -1 ? `of ${context.guild.name}` : `for last ${duration} days`}`, iconURL: context.guild.iconURL() || undefined})
			.setDescription(`${duration !== -1 ? `<t:${Math.floor(start.getTime() / 1000)}:F> - <t:${Math.floor(end.getTime() / 1000)}:F>\n` : ``}Showing ${wins ? "wins 🏅" : "points 🏆"}\n⠀\n` + leaderboard.map((entry: any, index: number) => `${(page - 1) * 10 + index + 1}. <@${entry.member}> • ${format(entry.value)}`).join("\n"))
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

	if (!msg.channel) return;
	const collector = msg.channel.createMessageComponentCollector({time: 60000});
	collector.on("collect", async i => {
		try {
			if (i instanceof ButtonInteraction) {
				if (i.message.id !== msg.id || i.user.id !== user.id) return;
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
			await buildLeaderboardPage(context, user, page, wins, duration, reply);
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

export async function tryLeaderboardEntryMessage(context: ServerContext, message: Message, content: string): Promise<boolean> {
	let accept = false;
	if (content.startsWith("lb ")) {
		accept = true;
		content = content.substring(3);
	}
	if (content === "lb") {
		accept = true;
	}
	if (content.split(" ").length > 0) {
		if (content.split(" ")[0].slice(-1) === "d") {
			await buildLeaderboardPage(context, message.author, 1, false, Math.max(0, Math.min(parseInt(content.split(" ")[0].slice(0, -1)), 30)), buildMessageReplyContext(message));
			return true;
		}
	}
	if (!accept) return false;
	await buildLeaderboardPage(context, message.author, 1, false, -1, buildMessageReplyContext(message));
	return true;
}