import {ButtonStyle, ChatInputCommandInteraction, Colors, EmbedBuilder, Guild, GuildMember, Message, SlashCommandBuilder, TextInputStyle, User} from "discord.js";
import {config, db, hasModAccess, logAction} from "../PointManager";
import {createErrorEmbed, format, toRewardString} from "../util/EmbedUtil";
import BotInteraction from "../util/BotInteraction";
import {RewardAnswer} from "../util/RewardManager";

export default {
	slashExclusive: false,
	stringyNames: ["removepoints", "removepoint", "removep", "rp", "remove", "removemoney", "removem", "rm", "removecoins", "removec", "rc", "remove-money", "remove-coins", "remove-win", "removewin", "remove-win", "removew", "rw"],
	slashData: new SlashCommandBuilder().setName("removewin").setDescription("Remove win from a member")
		.addIntegerOption(option => option.setName("points").setDescription("The amount of points to remove").setRequired(true))
		.addUserOption(option => option.setName("member").setDescription("The member to remove from")),
	execute: async (interaction: ChatInputCommandInteraction) => {
		if (!(interaction.member instanceof GuildMember) || !(interaction.guild instanceof Guild)) throw new Error("Member not found");
		const user: User = interaction.options.getUser("member") || interaction.user;
		const member: GuildMember = await interaction.guild.members.fetch(user);
		const points: number = interaction.options.getInteger("points", true);
		if (member.id !== interaction.user.id && !hasModAccess(interaction.member)) {
			await interaction.editReply(createErrorEmbed(interaction.user, "❌ You can't remove points from other members!"));
			return;
		}
		const err = await checkPointInput(points, interaction.user);
		if (err) {
			await interaction.editReply(err);
			return;
		}
		const multiplier = await db.getSettingProvider().getMultiplier();
		let realPoints = points;
		if (multiplier) {
			realPoints = Math.ceil(points * multiplier.amount);
		}
		const response = await db.removeWin(member, realPoints);
		if (member.id === interaction.user.id) {
			logAction(interaction.member, `Removed win of ${points} points`, Colors.Red, false);
		} else {
			logAction(interaction.member, `Removed win of ${points} points from ${member}`, Colors.Yellow);
		}
		await showRemoveWinEmbed(new BotInteraction(interaction), points, member, response.reward, multiplier);
	},
	executeStringy: async (message: Message) => {
		if (!message.member) throw new Error("Member not found");
		if (!config.channel_id.includes(message.channel.id)) return;
		let args = message.content.split(" ");
		args.shift();
		const target = message.mentions.members?.first() || message.member;
		args = args.filter(arg => !arg.startsWith("<@"));
		if (target.id !== message.author.id && !hasModAccess(message.member)) {
			await message.reply(createErrorEmbed(message.author, "❌ You can't remove points from other members!"));
			return;
		}
		const pointData = args.join(" ").replaceAll("*", "x").replaceAll("×", "x").split("x").map(s => s.trim());
		let points = parseInt(pointData[0]);
		for (let i = 1; i < Math.min(4, pointData.length); i++) {
			const factor = parseInt(pointData[i]);
			if (factor < 10) {
				points *= factor;
			} else points = NaN;
		}
		const err = await checkPointInput(points, message.author);
		if (err) {
			await message.reply(err);
			return;
		}
		const multiplier = await db.getSettingProvider().getMultiplier();
		let realPoints = points;
		if (multiplier) {
			realPoints = Math.ceil(points * multiplier.amount);
		}
		const response = await db.removeWin(target, realPoints);
		if (target.id === message.author.id) {
			logAction(message.member, `Removed win of ${points} points`, Colors.Red, false);
		} else {
			logAction(message.member, `Removed win of ${points} points from ${target.id}`, Colors.Yellow);
		}
		await showRemoveWinEmbed(new BotInteraction(message), points, target, response.reward, multiplier);
	}
}

async function showRemoveWinEmbed(interaction: BotInteraction, points: number, member: GuildMember, rewards: RewardAnswer[], multiplier?: { amount: number }) {
	await interaction.reply({
		embeds: [
			new EmbedBuilder().setAuthor({name: interaction.user.tag, iconURL: interaction.user.displayAvatarURL()}).setDescription(`Removed win of ${format(points)} ${multiplier ? `\`x ${multiplier.amount} (multiplier)\` ` : ``}points from ${interaction.user.id === member.id ? "your" : `${member}'s`} balance` + toRewardString(rewards, interaction.user.id === member.id, false)).setTimestamp().setColor(interaction.user.id === member.id ? Colors.Red : Colors.Yellow).toJSON()
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