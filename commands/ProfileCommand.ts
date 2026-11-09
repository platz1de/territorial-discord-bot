import {ActionRowBuilder, AttachmentBuilder, BaseMessageOptions, ButtonBuilder, ButtonInteraction, ButtonStyle, ChatInputCommandInteraction, Colors, EmbedBuilder, Message, SlashCommandBuilder, Snowflake, User} from "discord.js";
import {PointCommand, rewards} from "../PointManager.js";
import {format} from "../util/EmbedUtil.js";
import {getRawUser} from "../util/BotUserContext.js";
import {renderDualChart} from "../util/GraphRenderer.js";
import {buildMessageReplyContext} from "../util/InteractionContext.js";
import {ServerContext} from "../util/ServerContext.js";

export default {
	slashData: new SlashCommandBuilder().setName("profile").setDescription("See a member's profile")
		.addUserOption(option => option.setName("member").setDescription("The member to view")),
	execute: async (interaction: ChatInputCommandInteraction, context: ServerContext) => {
		const user: User = interaction.options.getUser("member") || interaction.user;
		await showProfileEmbed(context, interaction.user, user.id, 0, interaction.editReply);
	}
} as PointCommand;

export async function showProfileEmbed(context: ServerContext, user: User, target: Snowflake, page: number, reply: (content: BaseMessageOptions) => Promise<Message>) {
	const provider = getRawUser(context.guild.id, target);
	if (!provider) return;
	await provider.fetchMember();
	const embed = new EmbedBuilder();
	let files: AttachmentBuilder[] = [];
	switch (page) {
		case 0:
			const global = provider.getData();
			const last = provider.getDailyData(14);
			embed.addFields(
				{name: "Lifetime", value: `Points: ${format(global.points)} (#${provider.getAllTimePointRank()})\nWins: ${format(global.wins)} (#${provider.getAllTimeWinRank()})`, inline: true},
				{name: "Last 14 Days", value: `Points: ${format(last.points)} (#${provider.getDailyPointRank(14)})\nWins: ${format(last.wins)} (#${provider.getDailyWinRank(14)})`, inline: true}
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
				const buffer = await renderDualChart(provider.getLegacyData(30));
				files.push(new AttachmentBuilder(buffer).setName("chart.png"));
				embed.setImage("attachment://chart.png");
			} catch (e) {
				embed.setDescription("Failed to generate chart, please try again");
				console.error(e);
			}
			break;
	}
	const content : BaseMessageOptions = {
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

	const msg: Message = await reply(content);
	if (!msg.channel) return;
	const collector = msg.channel.createMessageComponentCollector({time: 60000});
	collector.on("collect", async i => {
		try {
			if (i instanceof ButtonInteraction) {
				if (i.message.id !== msg.id || i.user.id !== user.id) return;
				await i.deferUpdate();
				const pages = ["profile", "progress", "chart"];
				collector.stop();
				await showProfileEmbed(context, user, target, pages.indexOf(i.customId), reply);
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

export async function tryProfileEntryMessage(context: ServerContext, message: Message, content: string): Promise<boolean> {
	let user = null;
	if (content === "p") {
		await showProfileEmbed(context, message.author, message.author.id, 0, buildMessageReplyContext(message));
		return true;
	}
	if (content.split(" ").length > 0) {
		const arg = content.split(" ")[0];
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
	await showProfileEmbed(context, message.author, user, 0, buildMessageReplyContext(message));
	return true;
}