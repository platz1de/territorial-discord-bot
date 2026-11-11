import {ChatInputCommandInteraction, Colors, EmbedBuilder, Message, SlashCommandBuilder, Snowflake, User} from "discord.js";
import {PointCommand} from "../PointManager.js";
import {createErrorEmbed} from "../util/EmbedUtil.js";
import {createPointTransaction, PointTransaction} from "../util/PointTransaction.js";
import {ServerContext} from "../util/ServerContext.js";

export default {
	slashData: new SlashCommandBuilder().setName("removewin").setDescription("Remove win from a member")
		.addIntegerOption(option => option.setName("points").setDescription("The amount of points to remove").setRequired(true))
		.addUserOption(option => option.setName("member").setDescription("The member to remove from")),
	execute: async (interaction: ChatInputCommandInteraction, context: ServerContext) => {
		const user: User = interaction.options.getUser("member") || interaction.user;
		const points: number = interaction.options.getInteger("points", true);
		if (user.id !== interaction.user.id && !context.hasModAccess(interaction)) {
			await interaction.editReply(createErrorEmbed(interaction.user, "❌ You can't remove points from other members!"));
			return;
		}
		const err = await checkPointInput(points, interaction.user);
		if (err) {
			await interaction.editReply(err);
			return;
		}
		const multiplier = context.getActiveMultiplier();
		const transaction = await createPointTransaction(user.id, context.guild, multiplier, -points, -1);
		if (user.id !== interaction.user.id) {
			context.logAction(interaction.user, `Removed win of ${points} points from ${user}`, Colors.Yellow);
		}
		await interaction.editReply(buildRemoveWinEmbed(interaction.user, user.id, transaction));
	}
} as PointCommand;

function buildRemoveWinEmbed(user: User, target: Snowflake, transaction: PointTransaction) {
	return {
		embeds: [
			new EmbedBuilder().setAuthor({name: user.tag, iconURL: user.displayAvatarURL()}).setDescription(transaction.buildDescription(user.id === target)).setTimestamp().setColor(user.id === target ? Colors.Red : Colors.Yellow).toJSON()
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

export async function tryRemoveEntryMessage(context: ServerContext, message: Message, content: string): Promise<boolean> {
	if (!context.getSettings().channel_id.includes(message.channel?.id || "0")) return false;
	let args = content.split(" ");
	let target: Snowflake = message.author.id;
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
	if (target !== message.author.id && !context.hasModAccess(message)) {
		await message.reply(createErrorEmbed(message.author, "❌ You can't remove points from other members!"));
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
	const err = await checkPointInput(points, message.author);
	if (err) {
		await message.reply(err);
		return true;
	}
	const multiplier = context.getActiveMultiplier();
	const transaction = await createPointTransaction(target, context.guild, multiplier, -points, -1);
	if (target !== message.author.id) {
		context.logAction(message.author, `Removed win of ${points} points from <@${target}>`, Colors.Yellow);
	}
	await message.reply(buildRemoveWinEmbed(message.author, target, transaction));
	return true;
}