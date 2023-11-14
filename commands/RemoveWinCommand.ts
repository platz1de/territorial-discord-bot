import {ChatInputCommandInteraction, Colors, EmbedBuilder, SlashCommandBuilder, Snowflake, User} from "discord.js";
import {db, logAction, PointCommand} from "../PointManager";
import {createErrorEmbed, format, toRewardString} from "../util/EmbedUtil";
import {RewardAnswer} from "../util/RewardManager";
import {BotUserContext, getRawUser} from "../util/BotUserContext";

export default {
	slashData: new SlashCommandBuilder().setName("removewin").setDescription("Remove win from a member")
		.addIntegerOption(option => option.setName("points").setDescription("The amount of points to remove").setRequired(true))
		.addUserOption(option => option.setName("member").setDescription("The member to remove from")),
	execute: async (context: BotUserContext) => {
		const interaction = context.base as ChatInputCommandInteraction;
		const user: User = interaction.options.getUser("member") || context.user;
		const points: number = interaction.options.getInteger("points", true);
		if (user.id !== context.user.id && !context.hasModAccess()) {
			await context.reply(createErrorEmbed(interaction.user, "❌ You can't remove points from other members!"));
			return;
		}
		const err = await checkPointInput(points, interaction.user);
		if (err) {
			await context.reply(err);
			return;
		}
		const multiplier = await db.getSettingProvider().getMultiplier(context);
		let realPoints = points;
		if (multiplier) {
			realPoints = Math.ceil(points * multiplier.amount);
		}
		const response = await getRawUser(context.guild.id, user.id)?.removeWin(realPoints) || [];
		if (user.id !== context.user.id) {
			logAction(context, `Removed win of ${points} points from ${user}`, Colors.Yellow);
		}
		await showRemoveWinEmbed(context, points, user.id, response, multiplier);
	}
} as PointCommand;

async function showRemoveWinEmbed(context: BotUserContext, points: number, target: Snowflake, rewards: RewardAnswer[], multiplier?: { amount: number }) {
	await context.reply({
		embeds: [
			new EmbedBuilder().setAuthor({name: context.user.tag, iconURL: context.user.displayAvatarURL()}).setDescription(`Removed win of ${format(points)} ${multiplier ? `\`x ${multiplier.amount} (multiplier)\` ` : ``}points from ${context.user.id === target ? "your" : `<@${target}>'s`} balance` + toRewardString(rewards, context.user.id === target, false)).setTimestamp().setColor(context.user.id === target ? Colors.Red : Colors.Yellow).toJSON()
		]
	});
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