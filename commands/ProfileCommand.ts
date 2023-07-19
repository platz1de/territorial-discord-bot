import {ActionRowBuilder, AttachmentBuilder, ButtonBuilder, ButtonInteraction, ButtonStyle, ChatInputCommandInteraction, Colors, EmbedBuilder, Message, SlashCommandBuilder, Snowflake, User} from "discord.js";
import {Command, rewards} from "../PointManager";
import {format} from "../util/EmbedUtil";
import {BotUserContext, getRawUser} from "../util/BotUserContext";

const QuickChart = require("quickchart-js");

export default {
	slashExclusive: false,
	stringyNames: ["profile", "p", "bal", "balance", "pb"],
	slashData: new SlashCommandBuilder().setName("profile").setDescription("See a member's profile")
		.addUserOption(option => option.setName("member").setDescription("The member to view")),
	execute: async (context: BotUserContext) => {
		const interaction = context.base as ChatInputCommandInteraction;
		const user: User = interaction.options.getUser("member") || interaction.user;
		await showProfileEmbed(context, user.id, 0);
	},
	executeStringy: async (context: BotUserContext) => {
		const message = context.base as Message;
		let user = context.id;
		if (message.content.split(" ").length > 1) {
			const arg = message.content.split(" ")[1];
			if (arg.startsWith("<@") && arg.endsWith(">")) {
				user = arg.replace(/[<@!>]/g, "");
			} else if (arg.match(/^\d+$/)) {
				user = arg;
			} else {
				const diff = Infinity;
				for (const member of context.guild.members.cache.values()) {
					if (member.user.tag.toLowerCase().includes(arg.toLowerCase())) {
						const newDiff = member.displayName.length - arg.length;
						if (newDiff < diff) {
							user = member.id;
						}
					}
					if (member.displayName.toLowerCase().includes(arg.toLowerCase())) {
						const newDiff = member.displayName.length - arg.length;
						if (newDiff < diff) {
							user = member.id;
						}
					}
				}
			}
		}
		await showProfileEmbed(context, user, 0);
	}
} as Command;

async function showProfileEmbed(context: BotUserContext, target: Snowflake, page: number) {
	const provider = target === context.id ? context : getRawUser(context.guild.id, target);
	if (!provider) return;
	const embed = new EmbedBuilder();
	let files: AttachmentBuilder[] = [];
	switch (page) {
		case 0:
			const global = await provider.getData();
			const last = await provider.getDailyData(14);
			embed.addFields(
				{name: "Lifetime", value: `Points: ${format(global.points)} (#${await provider.getAllTimePointRank()})\nWins: ${format(global.wins)} (#${await provider.getAllTimeWinRank()})`, inline: true},
				{name: "Last 14 Days", value: `Points: ${format(last.points)} (#${await provider.getDailyPointRank(14)})\nWins: ${format(last.wins)} (#${await provider.getDailyWinRank(14)})`, inline: true}
			);
			break;
		case 1:
			const next: { role: Snowflake, has: number, needs: number }[] = await rewards.getProgress(context);
			embed.addFields(
				next.length > 0 ? {name: "Next Reward", value: next.map(r => `<@&${r.role}>\n[${'🟦'.repeat(Math.floor(r.has / r.needs * 10))}${'⬜'.repeat(10 - Math.floor(r.has / r.needs * 10))}] ${r.has}/${r.needs} (${Math.floor(r.has / r.needs * 100)}%)`).join("\n\n")}
					: {name: "All done", value: "You already have all the rewards, good job!"}
			);
			break;
		case 2:
			const data: { day: string, wins: number, points: number }[] = await provider.getLegacyData(30);
			const qc = new QuickChart();
			qc.setConfig({
				type: "line",
				data: {
					labels: data.map(d => d.day),
					datasets: [
						{label: "Points", data: data.map(d => d.points), yAxisID: "A"},
						{label: "Wins", data: data.map(d => d.wins), yAxisID: "B"}
					]
				},
				options: {
					scales: {
						yAxes: [{
							id: "A",
							type: "linear",
							position: "left"
						}, {
							id: "B",
							type: "linear",
							position: "right"
						}]
					}
				}
			});
			try {
				files.push(new AttachmentBuilder(await qc.toBinary()).setName("chart.png"));
				embed.setImage("attachment://chart.png");
			} catch (e) {
				embed.setDescription("Failed to generate chart, please try again");
				console.error(e);
			}
			break;
	}
	const msg = await context.reply({
		embeds: [
			embed.setAuthor({name: provider.user.tag, iconURL: provider.user.displayAvatarURL()}).setColor(Colors.Green).setTimestamp().toJSON()
		], components: [
			new ActionRowBuilder<ButtonBuilder>().addComponents(
				new ButtonBuilder().setCustomId("profile").setEmoji("👤").setStyle(ButtonStyle.Primary).setDisabled(page === 0),
				new ButtonBuilder().setCustomId("progress").setEmoji("🚀").setStyle(ButtonStyle.Primary).setDisabled(page === 1),
				new ButtonBuilder().setCustomId("chart").setEmoji("📊").setStyle(ButtonStyle.Primary).setDisabled(page === 2)
			)
		],
		files: files
	});

	if (!context.channel) return;
	const collector = context.channel.createMessageComponentCollector({time: 60000});
	collector.on("collect", async i => {
		if (i instanceof ButtonInteraction) {
			if (i.message.id !== msg.id || i.user.id !== context.user.id) return;
			await i.deferUpdate();
			const pages = ["profile", "progress", "chart"];
			collector.stop();
			await showProfileEmbed(context, target, pages.indexOf(i.customId));
		} else {
			return;
		}
	});

	collector.on("end", async (collected, reason) => {
		try {
			reason === "time" && await msg.edit({components: []})
		} catch (e) {
		}
	});
}