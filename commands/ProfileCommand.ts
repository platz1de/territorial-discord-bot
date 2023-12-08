import {ActionRowBuilder, AttachmentBuilder, ButtonBuilder, ButtonInteraction, ButtonStyle, ChatInputCommandInteraction, Colors, EmbedBuilder, InteractionReplyOptions, Message, SlashCommandBuilder, Snowflake, User} from "discord.js";
import {PointCommand, rewards} from "../PointManager";
import {format} from "../util/EmbedUtil";
import {BotUserContext, getRawUser} from "../util/BotUserContext";
import {renderDualChart} from "../util/GraphRenderer";

export default {
	slashData: new SlashCommandBuilder().setName("profile").setDescription("See a member's profile")
		.addUserOption(option => option.setName("member").setDescription("The member to view")),
	execute: async (context: BotUserContext) => {
		const interaction = context.base as ChatInputCommandInteraction;
		const user: User = interaction.options.getUser("member") || interaction.user;
		await showProfileEmbed(context, user.id, 0);
	}
} as PointCommand;

export async function showProfileEmbed(context: BotUserContext, target: Snowflake, page: number, ephemeral: boolean = false) {
	const provider = target === context.id ? context : getRawUser(context.guild.id, target);
	if (!provider) return;
	await provider.fetchMember();
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
			const next: { role: Snowflake, has: number, needs: number }[] = await rewards.getProgress(provider);
			embed.addFields(
				next.length > 0 ? {name: "Next Reward", value: next.map(r => `<@&${r.role}>\n[${'🟦'.repeat(Math.floor(r.has / r.needs * 10))}${'⬜'.repeat(10 - Math.floor(r.has / r.needs * 10))}] ${r.has}/${r.needs} (${Math.floor(r.has / r.needs * 100)}%)`).join("\n\n")}
					: {name: "All done", value: "You already have all the rewards, good job!"}
			);
			break;
		case 2:
			try {
				const buffer = await renderDualChart(await provider.getLegacyData(30));
				files.push(new AttachmentBuilder(buffer).setName("chart.png"));
				embed.setImage("attachment://chart.png");
			} catch (e) {
				embed.setDescription("Failed to generate chart, please try again");
				console.error(e);
			}
			break;
	}
	const content : InteractionReplyOptions = {
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
	};

	let msg: Message;
	if (ephemeral && context.base && !(context.base instanceof Message)) {
		content.ephemeral = true;
		let response = await context.base.reply(content);
		msg = await response.fetch();
	} else {
		msg = await context.reply(content);
	}

	if (!context.channel) return;
	const collector = context.channel.createMessageComponentCollector({time: 60000});
	collector.on("collect", async i => {
		try {
			if (i instanceof ButtonInteraction) {
				if (i.message.id !== msg.id || i.user.id !== context.user.id) return;
				await i.deferUpdate();
				const pages = ["profile", "progress", "chart"];
				collector.stop();
				await showProfileEmbed(context, target, pages.indexOf(i.customId));
			} else {
				return;
			}
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

export async function tryProfileEntryMessage(context: BotUserContext, message: string): Promise<boolean> {
	let user = null;
	if (message === "p") {
		await showProfileEmbed(context, context.id, 0);
		return true;
	}
	if (message.split(" ").length > 0) {
		const arg = message.split(" ")[0];
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
	if (!user) return false;
	await showProfileEmbed(context, user, 0);
	return true;
}