import {ActionRowBuilder, ButtonBuilder, ButtonStyle, Colors, EmbedBuilder, GuildMember, Interaction, Message, NewsChannel, Snowflake, TextChannel} from "discord.js";
import {client} from "../PointManager";
import {getGuildsForClan, getServerContext} from "../BotSettingProvider";
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
		let buttons = [];
		for (const factor in context.factor_buttons) {
			buttons.push(
				new ButtonBuilder().setCustomId(`claim_factor_${factor}`).setLabel(context.factor_buttons[factor].name).setStyle(ButtonStyle.Primary)
			);
		}
		if (buttons.length === 0) {
			buttons.push(
				new ButtonBuilder().setCustomId("claim").setLabel("Claim Points").setStyle(ButtonStyle.Primary)
			);
		}
		let msg = await channel.send({
			content: message,
			components: [
				new ActionRowBuilder<ButtonBuilder>().addComponents(buttons)
			]
		}).catch(() => {});
		if (!msg) continue;
		messageCache[msg.id] = {msg, points, timestamp: Date.now(), claimed: []};
	}
}

function updateMessage(message: Message, isFirst: boolean, user: Snowflake, factor: number) {
	let msg = message.content;
	if (isFirst) {
		msg += "\n\n**Claimed by:**";
	}
	msg += `\n<@${user}>` + (factor !== 1 ? ` \`x ${factor}\`` : ``);
	message.edit({
		content: msg
	}).catch(() => {});
}

export async function handleFeedInteraction(interaction: Interaction) {
	if (!interaction.isButton() || !(interaction.member instanceof GuildMember)) return;
	if (interaction.customId !== "claim" && !interaction.customId.startsWith("claim_factor_")) return;
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
		}).catch(() => {});
		return;
	}
	let points = cache.points;
	let realPoints = points;
	if (context.context.multiplier) {
		realPoints = Math.ceil(realPoints * context.context.multiplier.amount);
	}
	let factorInt = 1;
	if (interaction.customId.startsWith("claim_factor_")) {
		const factor = interaction.customId.substring(13);
		if (!context.context.factor_buttons[parseInt(factor)]) return;
		realPoints = Math.ceil(realPoints * context.context.factor_buttons[parseInt(factor)].factor);
		points = Math.ceil(points * context.context.factor_buttons[parseInt(factor)].factor);
		factorInt = context.context.factor_buttons[parseInt(factor)].factor;
	}
	context.registerWin(realPoints).then((response) => {
		cache.claimed.push(interaction.user.id);
		updateMessage(cache.msg, cache.claimed.length === 1, interaction.user.id, factorInt);
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