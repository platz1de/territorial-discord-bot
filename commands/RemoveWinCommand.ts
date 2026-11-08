import {ChatInputCommandInteraction, Colors, EmbedBuilder, Message, SlashCommandBuilder, Snowflake, User} from "discord.js";
import {logAction, PointCommand} from "../PointManager.js";
import {createErrorEmbed} from "../util/EmbedUtil.js";
import {BotUserContext, getRawUser} from "../util/BotUserContext.js";
import {createPointTransaction, PointTransaction} from "../util/PointTransaction.js";

export default {
	slashData: new SlashCommandBuilder().setName("removewin").setDescription("Remove win from a member")
		.addIntegerOption(option => option.setName("points").setDescription("The amount of points to remove").setRequired(true))
		.addUserOption(option => option.setName("member").setDescription("The member to remove from")),
	execute: async (context: BotUserContext) => {
		const interaction = context.base as ChatInputCommandInteraction;
		const user: User = interaction.options.getUser("member") || context.user;
		const points: number = interaction.options.getInteger("points", true);
		if (user.id !== context.user.id && !context.hasModAccess()) {
			await interaction.editReply(createErrorEmbed(interaction.user, "❌ You can't remove points from other members!"));
			return;
		}
		const err = await checkPointInput(points, interaction.user);
		if (err) {
			await interaction.editReply(err);
			return;
		}
		const multiplier = context.getActiveMultiplier();
		const transaction = await createPointTransaction(getRawUser(context.guild.id, user.id)!, multiplier, -points, -1);
		if (user.id !== context.user.id) {
			logAction(context, `Removed win of ${points} points from ${user}`, Colors.Yellow);
		}
		await interaction.editReply(buildRemoveWinEmbed(context, user.id, transaction));
	}
} as PointCommand;

function buildRemoveWinEmbed(context: BotUserContext, target: Snowflake, transaction: PointTransaction) {
	return {
		embeds: [
			new EmbedBuilder().setAuthor({name: context.user.tag, iconURL: context.user.displayAvatarURL()}).setDescription(transaction.buildDescription(context.user.id === target)).setTimestamp().setColor(context.user.id === target ? Colors.Red : Colors.Yellow).toJSON()
		]
	};
}

async function checkPointInput(points: number, user: User) {
	if (points <= 0 || isNaN(points)) {
		return createErrorEmbed(user, "⚠ You need to specify a positive amount of points!");
	}
	if (points > 1024) { //2 * 512
		return createErrorEmbed(user, "⚠ Please only add as many points as you have gained!");
	}
	return false;
}

export async function tryRemoveEntryMessage(context: BotUserContext, message: Message, content: string): Promise<boolean> {
	if (!context.getSettings().channel_id.includes(context.channel?.id || "0")) return false;
	let args = content.split(" ");
	let target: Snowflake = context.id;
	if (args[0]?.match(/<@!?\d+>/)) {
		// @ts-ignore
		target = args[0].match(/<@!?(\d+)>/)[1];
		args.shift();
	} else if (args[1]?.match(/<@!?\d+>/)) {
		// @ts-ignore
		target = args[1].match(/<@!?(\d+)>/)[1];
	} else if (!isNaN(parseInt(args[0])) && !isNaN(parseInt(args[1]))) {
		target = args[0];
		args.shift();
	}
	if (target !== context.user.id && !context.hasModAccess()) {
		await message.reply(createErrorEmbed(context.user, "❌ You can't remove points from other members!"));
		return true;
	}
	const pointData = args.join(" ").replaceAll("*", "x").replaceAll("×", "x").split("x").map(s => s.trim());
	let points = parseInt(pointData[0]);
	for (let i = 1; i < Math.min(4, pointData.length); i++) {
		const factor = parseInt(pointData[i]);
		if (factor < 10) {
			points *= factor;
		} else points = NaN;
	}
	if (isNaN(points) || points >= 0) {
		return false; //Not the right command probably
	}
	points = -points;
	const err = await checkPointInput(points, context.user);
	if (err) {
		await message.reply(err);
		return true;
	}
	const multiplier = context.getActiveMultiplier();
	const transaction = await createPointTransaction(getRawUser(context.guild.id, target)!, multiplier, -points, -1);
	if (target !== context.user.id) {
		logAction(context, `Removed win of ${points} points from <@${target}>`, Colors.Yellow);
	}
	await message.reply(buildRemoveWinEmbed(context, target, transaction));
	return true;
}