import {getDefaults, ServerSetting, setServerSetting} from "../BotSettingProvider";
import {ChatInputCommandInteraction, Message, PermissionFlagsBits} from "discord.js";
import {getCommandId, rewards} from "../PointManager";
import {BaseUserContext} from "./BaseUserContext";

interface SetupDialog {
	data: ServerSetting,
	step: number
}

const dialogues: { [key: string]: SetupDialog } = {};

const steps = [
	{
		question: "What is your win submission channel?",
		description: "The bot will only listen to point commands in that channel. You can add more channels later.\nProfile and leaderboard commands will always work in every channel.\nPlease respond with a channel mention or id.",
		validate: (context: BaseUserContext, message: string) => {
			return context.guild.channels.cache.has(getChannelId(message));
		},
		response: (message: string) => {
			return `Set win submission channel to <#${getChannelId(message)}>.`;
		},
		handle: (setting: ServerSetting, message: string) => {
			setting.channel_id.push(getChannelId(message));
		}
	},
	{
		question: "What is your log channel?",
		description: "The bot will send a message to that channel whenever moderator commands are used.\nPlease respond with a channel mention or id.",
		validate: (context: BaseUserContext, message: string) => {
			return context.guild.channels.cache.has(getChannelId(message));
		},
		response: (message: string) => {
			return `Set log channel to <#${getChannelId(message)}>.`;
		},
		handle: (setting: ServerSetting, message: string) => {
			setting.log_channel_id = getChannelId(message);
		}
	},
	{
		question: "What is your role for moderators?",
		description: "Users with this role will be able to use moderator commands. You can add more roles later.\nPlease respond with a role mention or id.",
		validate: (context: BaseUserContext, message: string) => {
			return context.guild.roles.cache.has(getRoleId(message));
		},
		response: (message: string) => {
			return `Set moderator role to <@&${getRoleId(message)}>.`;
		},
		handle: (setting: ServerSetting, message: string) => {
			setting.mod_roles.push(getRoleId(message));
		}
	},
	{
		question: "Is your role system cumulative or incremental?",
		description: "Cumulative: Users will get all roles they have enough points for. Answer with `all` or `c`\nIncremental: Users will only get the highest role they have enough points for. Answer with `inc` or `i`",
		validate: (context: BaseUserContext, message: string) => {
			return message.toLowerCase() === "inc" || message.toLowerCase() === "i" || message.toLowerCase() === "all" || message.toLowerCase() === "c";
		},
		response: (message: string) => {
			if (message.toLowerCase() === "inc" || message.toLowerCase() === "i") {
				return `Set role system to incremental.`;
			} else {
				return `Set role system to cumulative.`;
			}
		},
		handle: (setting: ServerSetting, message: string) => {
			if (message.toLowerCase() === "inc" || message.toLowerCase() === "i") {
				setting.roles = "highest";
			} else {
				setting.roles = "all";
			}
		}
	},
	{
		question: "Please set a channel for bot updates.",
		description: "The bot will send a message to that channel whenever important updates are released. It's recommended to use your staff channel here.\nPlease respond with a channel mention or id.",
		validate: (context: BaseUserContext, message: string) => {
			return context.guild.channels.cache.has(getChannelId(message));
		},
		response: (message: string) => {
			return `Set update channel to <#${getChannelId(message)}>.`;
		},
		handle: (setting: ServerSetting, message: string) => {
			setting.update_channel_id = getChannelId(message);
		}
	}
];

export function startDialog(context: BaseUserContext) {
	let base = context.base as ChatInputCommandInteraction;
	if (!context.member || !context.member.permissions.has(PermissionFlagsBits.ManageRoles) || !base.channel) {
		context.reply({
			embeds: [{
				title: "Setup failed",
				description: "You need the `Manage Roles` permission to use this command.",
				color: 0xff0000
			}]
		}).catch(() => {});
		return;
	}
	dialogues[context.guild.id + ":" + context.user.id + ":" + context.channel?.id] = {data: getDefaults(), step: 0};
	sendStep(context, undefined);
}

export function hasDialog(message: Message) {
	return dialogues.hasOwnProperty(message.guild?.id + ":" + message.author.id + ":" + message.channel?.id);
}

export function handleDialog(context: BaseUserContext, message: string) {
	let dialogue = dialogues[context.guild?.id + ":" + context.user.id + ":" + context.channel?.id];
	if (message.toLowerCase() === "cancel") {
		delete dialogues[context.guild.id + ":" + context.user.id + ":" + context.channel?.id];
		context.reply({
			embeds: [{
				title: "Setup cancelled",
				description: "The setup has been cancelled.",
				color: 0xff0000
			}]
		}).catch(console.error);
		return;
	}
	if (!steps[dialogue.step].validate(context, message)) {
		context.reply({
			embeds: [{
				title: "Invalid input",
				description: "Your input is invalid. Please try again.",
				color: 0xff0000
			}]
		}).catch(console.error);
		return;
	}
	steps[dialogue.step].handle(dialogue.data, message);
	dialogue.step++;
	if (dialogue.step >= steps.length) {
		delete dialogues[context.guild.id + ":" + context.user.id + ":" + context.channel?.id];
		if (!context.guild) {
			context.reply({
				embeds: [{
					title: "Setup failed",
					description: "Something went wrong. Please try again.",
					color: 0xff0000
				}]
			}).catch(console.error);
			return;
		}
		dialogue.data.guild_id = context.guild.id;
		setServerSetting(dialogue.data);
		rewards.loadRewards(dialogue.data);
		context.reply({
			embeds: [{
				title: "Setup finished",
				description: `The setup has been finished. Settings can be changed using \`</settings show:${getCommandId("settings")}>\` at any point.\nIf you want to setup reward roles, you can do it there as well.`,
				color: 0x00ff00
			}]
		}).catch(console.error);
		return;
	}
	sendStep(context, steps[dialogue.step - 1].response(message));
}

function sendStep(context: BaseUserContext, extra?: string) {
	let dialogue = dialogues[context.guild.id + ":" + context.user.id + ":" + context.channel?.id];
	context.reply({
		content: extra,
		embeds: [{
			title: steps[dialogue.step].question,
			description: steps[dialogue.step].description,
			color: 0x00ff00,
			footer: {
				text: "Reply with your answer to this message - Type \"cancel\" to cancel the setup."
			}
		}]
	}).catch(console.error);
}

function getChannelId(message: string): string {
	if (message.startsWith("<#") && message.endsWith(">")) {
		message = message.substring(2, message.length - 1);
	}
	return message;
}

function getRoleId(message: string): string {
	if (message.startsWith("<@&") && message.endsWith(">")) {
		message = message.substring(3, message.length - 1);
	}
	return message;
}