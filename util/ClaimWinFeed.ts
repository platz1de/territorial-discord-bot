import {ActionRowBuilder, ButtonBuilder, ButtonStyle, Colors, EmbedBuilder, GuildMember, Interaction, Message, MessageFlags, NewsChannel, Snowflake, TextChannel} from "discord.js";
import {client} from "../PointManager.js";
import {getGuildsForClan, getServerContext} from "../BotSettingProvider.js";
import {ClanGame} from "./ClanGame.js";
import {BulkPointTransaction} from "./BulkPointTransaction.js";
import {createServerContext} from "./ServerContext.js";

let messageCache: { [key: Snowflake]: { msg: Message, timestamp: number, original: string, transaction: BulkPointTransaction } } = {};

export async function sendToFeed(clan: string, message: string, points: number, gameDetails: ClanGame) {
	for (const guild of getGuildsForClan(clan)) {
		const g = client.guilds.cache.get(guild);
		if (!g) continue;
		const context = getServerContext(guild);
		if (!context) continue;
		if (!context.win_feed) continue;
		// TODO: Use getWinFeedChannel once we have a proper guild context
		const channel = g.channels.cache.get(context.win_feed);
		if (!channel || !(channel instanceof TextChannel || channel instanceof NewsChannel)) continue;

		let buttons = context.factor_buttons.map(( factor, index ) =>
			new ButtonBuilder().setCustomId(`claim_factor_${index}`).setLabel(context.factor_buttons[index].name).setStyle(ButtonStyle.Primary)
		 );

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
		// TODO: Migrate this to getActiveMultiplier
		messageCache[msg.id] = {msg, timestamp: Date.now(), original: message, transaction: new BulkPointTransaction(g, context.multiplier, points, 1)};
	}
}

export async function handleFeedInteraction(interaction: Interaction) {
	if (!interaction.isButton() || !(interaction.member instanceof GuildMember)) return;
	if (interaction.customId !== "claim" && !interaction.customId.startsWith("claim_factor_")) return;
	const context = createServerContext(interaction.guild);
	if (!context) return;
	const message = interaction.message;
	if (!message) return;
	if (!messageCache[message.id]) return;
	const cache = messageCache[message.id];
	if (cache.timestamp + 300000 < Date.now()) return;

	let factorInt = 1;
	if (interaction.customId.startsWith("claim_factor_")) {
		let factor = context.getSettings().factor_buttons[parseInt(interaction.customId.substring(13))] ;
		if (!factor) return;
		factorInt = factor.factor;
	}

	//Already claimed with this factor
	if (cache.transaction.getAppliedFactor(interaction.user.id) == factorInt) {
		interaction.reply({
			embeds: [
				new EmbedBuilder().setAuthor({name: interaction.user.tag, iconURL: interaction.user.displayAvatarURL()}).setDescription("You have already claimed this win!").setColor(Colors.Red).setTimestamp().toJSON()
			],
			flags: MessageFlags.Ephemeral
		}).catch(() => {});
		return;
	}

	await cache.transaction.apply(interaction.member.id, factorInt);
	await cache.msg.edit({content: cache.transaction.claimedUserList(cache.original)});
	interaction.reply({
		embeds: [
			new EmbedBuilder().setAuthor({name: interaction.user.tag, iconURL: interaction.user.displayAvatarURL()}).setDescription(cache.transaction.getPart(interaction.user.id)!.buildDescription(true)).setColor(Colors.Green).setTimestamp().toJSON()
		],
		flags: MessageFlags.Ephemeral
	}).catch(() => {});
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