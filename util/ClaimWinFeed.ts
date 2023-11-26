import {ActionRowBuilder, ButtonBuilder, ButtonStyle, Colors, EmbedBuilder, GuildMember, Interaction, Message, NewsChannel, Snowflake, TextChannel} from "discord.js";
import {client} from "../PointManager";
import {getGuildsForClan} from "./TTHQ";
import {getServerContext} from "../BotSettingProvider";
import {BotUserContext, getUser} from "./BotUserContext";
import {format, toRewardString} from "./EmbedUtil";

let messageCache: { [key: Snowflake]: { msg: Message, points: number, timestamp: number, claimed: Snowflake[] } } = {};

export async function sendToFeed(clan: string, message: string, points: number) {
	for (const guild of getGuildsForClan(clan)) {
		const g = client.guilds.cache.get(guild);
		if (!g) continue;
		const context = getServerContext(guild);
		if (!context) continue;
		if (!context.win_feed) continue;
		const channel = g.channels.cache.get(context.win_feed);
		if (!channel || !(channel instanceof TextChannel || channel instanceof NewsChannel)) continue;
		let msg = await channel.send({
			content: message,
			components: [
				new ActionRowBuilder<ButtonBuilder>().addComponents(
					new ButtonBuilder().setCustomId("claim").setLabel("Claim Points").setStyle(ButtonStyle.Primary)
				)
			]
		}).catch(() => {});
		if (!msg) continue;
		messageCache[msg.id] = {msg, points, timestamp: Date.now(), claimed: []};
	}
}

function updateMessage(message: Message, isFirst: boolean, user: Snowflake) {
	let msg = message.content;
	if (isFirst) {
		msg += "\n\n**Claimed by:**";
	}
	msg += `\n<@${user}>`;
	message.edit({
		content: msg
	}).catch(() => {});
}

export async function handleInteraction(interaction: Interaction) {
	if (!interaction.isButton() || !(interaction.member instanceof GuildMember)) return;
	if (interaction.customId !== "claim") return;
	const context = getUser(interaction.member, interaction);
	if (!(context instanceof BotUserContext)) return;
	const message = interaction.message;
	if (!message) return;
	if (!messageCache[message.id]) return;
	const cache = messageCache[message.id];
	if (cache.timestamp + 300000 < Date.now()) return;
	if (cache.claimed.includes(interaction.user.id)) {
		interaction.reply({
			embeds: [
				new EmbedBuilder().setAuthor(context.asAuthor()).setDescription("You have already claimed this win!").setColor(Colors.Red).setTimestamp().toJSON()
			],
			ephemeral: true
		});
		return;
	}
	let points = cache.points;
	if (context.context.multiplier) {
		points = Math.ceil(points * context.context.multiplier.amount);
	}
	context.registerWin(points).then((response) => {
		cache.claimed.push(interaction.user.id);
		updateMessage(cache.msg, cache.claimed.length === 1, interaction.user.id);
		interaction.reply({
			embeds: [
				new EmbedBuilder().setAuthor(context.asAuthor()).setDescription(`Registered win of ${format(points)} ${context.context.multiplier ? `\`x ${context.context.multiplier.amount} (multiplier)\` ` : ``}points to your balance` + toRewardString(response, true, false)).setTimestamp().setColor(Colors.Green).toJSON()
			],
			ephemeral: true
		}).catch(() => {});
	});
}

function refresh() {
	for (const id of Object.keys(messageCache)) {
		const cache = messageCache[id];
		if (cache.timestamp + 300000 < Date.now()) {
			cache.msg.edit({
				components: []
			}).catch(() => {});
			delete messageCache[id];
		}
	}
}

setInterval(refresh, 10000);