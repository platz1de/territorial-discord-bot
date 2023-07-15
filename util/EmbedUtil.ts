import {Colors, EmbedBuilder, User} from "discord.js";
import {RewardAnswer} from "./RewardManager";

function createErrorEmbed(user: User, message: string) {
	return {embeds: [new EmbedBuilder().setAuthor({name: user.tag, iconURL: user.displayAvatarURL()}).setDescription(message).setTimestamp().setColor(Colors.Red).toJSON()]};
}

function createConfirmationEmbed(user: User, message: string) {
	return {embeds: [new EmbedBuilder().setAuthor({name: user.tag, iconURL: user.displayAvatarURL()}).setDescription(message).setTimestamp().setColor(Colors.Green).toJSON()]};
}

function toRewardString(rewards: RewardAnswer[], personal: boolean, short: boolean) {
	if (rewards.length === 0) return "";
	if (rewards[0].type === "Removed") personal = false;
	return (short ? "\n" : "\n\n") + (personal ? "You gained" : rewards[0].type) + (rewards.length === 1 ? " " : ":\n") + rewards.map(r => `<@&${r.role_id}> for ${r.description}`).join("\n") + (personal ? "\nKeep up the good work! 💪" : "");
}

function format(points: number) {
	return points.toString().replace(/(.)(?=(\d{3})+$)/g, "$1.");
}

function formatTime(time: number) {
	let res = "";
	const days = Math.floor(time / 86400);
	if (days > 0) res += `${days}d `;
	const hours = Math.floor(time / 3600) % 24;
	if (hours > 0) res += `${hours}h `;
	const minutes = Math.floor(time / 60) % 60;
	if (minutes > 0) res += `${minutes}m `;
	const seconds = Math.floor(time) % 60;
	if (seconds > 0) res += `${seconds}s`;
	return res.trim();
}

export {createErrorEmbed, toRewardString, format, formatTime, createConfirmationEmbed};