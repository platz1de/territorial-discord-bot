import {ActionRowBuilder, ButtonBuilder, ButtonStyle, Colors, EmbedBuilder, GuildMember, Interaction, Message, MessageFlags, NewsChannel, Snowflake, TextChannel} from "discord.js";
import {client} from "../PointManager.js";
import {getGuildsForClan, getServerContext} from "../BotSettingProvider.js";
import {BotUserContext, getUser} from "./BotUserContext.js";
import {format, toRewardString} from "./EmbedUtil.js";
import {ClanGame} from "./ClanGame.js";

interface claimedCache{ [key: Snowflake]: number };
let messageCache: { [key: Snowflake]: { msg: Message, points: number, timestamp: number, claimed: claimedCache } } = {};

export async function sendToFeed(clan: string, message: string, points: number, gameDetails: ClanGame) {
	for (const guild of getGuildsForClan(clan)) {
		const g = client.guilds.cache.get(guild);
		if (!g) continue;
		const context = getServerContext(guild);
		if (!context) continue;
		if (!context.win_feed) continue;
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
		let claimed: claimedCache = {};
		let msg = await channel.send({
			content: message,
			components: [
				new ActionRowBuilder<ButtonBuilder>().addComponents(buttons)
			]
		}).catch(() => {});
		if (!msg) continue;
		messageCache[msg.id] = {msg, points, timestamp: Date.now(), claimed: claimed};
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

	let points = cache.points;
	let realPoints = points;
	
	let factorInt = 1;
	let isClaimEdit = false;
	if (interaction.customId.startsWith("claim_factor_")) {
		let factor = context.context.factor_buttons[parseInt(interaction.customId.substring(13))] ;
		if (!factor) return;
		factorInt = factor.factor;
	}
	points = Math.ceil(points * factorInt );
	realPoints = Math.ceil(points * (context.context.multiplier ? context.context.multiplier.amount : 1));

	//Already claimed with this factor
	if (cache.claimed[interaction.user.id] && cache.claimed[interaction.user.id] == factorInt ) {
		interaction.reply({
			embeds: [
				new EmbedBuilder().setAuthor(context.asAuthor()).setDescription("You have already claimed this win!").setColor(Colors.Red).setTimestamp().toJSON()
			],
			flags: MessageFlags.Ephemeral
		}).catch(() => {});
		return;
	}
	//Change claimed factor
	else if(cache.claimed[interaction.user.id] && cache.claimed[interaction.user.id] != factorInt )
	{
		isClaimEdit = true;
		//Calculate points to remove using previously claimed factor
		const realPoints = Math.ceil(
					cache.points * cache.claimed[interaction.user.id] * (context.context.multiplier ? context.context.multiplier.amount : 1));
		const regex = new RegExp( '\n<\@' + interaction.user.id + '>.*');
		//Edit will be executed later by registerWin response
		message.content = message.content.replace( regex, '' );
		await context.removeWin(realPoints);
	}
	context.registerWin(realPoints).then((response) => {
		cache.claimed[interaction.user.id] = factorInt;
		updateMessage(cache.msg, Object.keys(cache.claimed).length == 1 && !isClaimEdit, interaction.user.id, factorInt);
		interaction.reply({
			embeds: [
				new EmbedBuilder().setAuthor(context.asAuthor()).setDescription(`Registered win of ${format(points)} ${context.context.multiplier ? `\`x ${context.context.multiplier.amount} (multiplier)\` ` : ``}points to your balance` + toRewardString(response, true, false)).setTimestamp().setColor(Colors.Green).toJSON()
			],
			flags: MessageFlags.Ephemeral
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