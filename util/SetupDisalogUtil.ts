import {getDefaults, ServerSetting, setServerSetting} from "../BotSettingProvider";
import {Message, PermissionFlagsBits} from "discord.js";
import {rewards} from "../PointManager";

interface SetupDialog {
	data: ServerSetting,
	step: number
}

const dialogues: { [key: string]: SetupDialog } = {};

const steps = [
	{
		question: "What is the prefix for this server?",
		description: "All commands must later start with this prefix. Example: if you set the prefix to `!`, you can use `!help` to get a list of commands.",
		validate: (message: Message) => {
			return message.content.length > 0 && message.content.length < 10;
		},
		response: (message: Message) => {
			return `Set prefix to \`${message.content}\` for command usage like \`${message.content}help\`.`;
		},
		handle: (setting: ServerSetting, message: Message) => {
			setting.prefix = message.content;
		}
	},
	{
		question: "What is your win submission channel?",
		description: "The bot will only listen to point commands in that channel. You can add more channels later.\nProfile and leaderboard commands will always work in every channel.\nPlease respond with a channel mention or id.",
		validate: (message: Message) => {
			return message.guild?.channels.cache.has(getChannelId(message.content));
		},
		response: (message: Message) => {
			return `Set win submission channel to <#${getChannelId(message.content)}>.`;
		},
		handle: (setting: ServerSetting, message: Message) => {
			setting.channel_id.push(getChannelId(message.content));
		}
	},
	{
		question: "What is your log channel?",
		description: "The bot will send a message to that channel whenever moderator commands are used.\nPlease respond with a channel mention or id.",
		validate: (message: Message) => {
			return message.guild?.channels.cache.has(getChannelId(message.content));
		},
		response: (message: Message) => {
			return `Set log channel to <#${getChannelId(message.content)}>.`;
		},
		handle: (setting: ServerSetting, message: Message) => {
			setting.log_channel_id = getChannelId(message.content);
		}
	},
	{
		question: "What is your role for moderators?",
		description: "Users with this role will be able to use moderator commands. You can add more roles later.\nPlease respond with a role mention or id.",
		validate: (message: Message) => {
			return message.guild?.roles.cache.has(getRoleId(message.content));
		},
		response: (message: Message) => {
			return `Set moderator role to <@&${getRoleId(message.content)}>.`;
		},
		handle: (setting: ServerSetting, message: Message) => {
			setting.mod_roles.push(getRoleId(message.content));
		}
	},
	{
		question: "Is your role system incremental or cumulative?",
		description: "Incremental: Users will only get the highest role they have enough points for. Answer with `inc` or `i`\nCumulative: Users will get all roles they have enough points for. Answer with `all` or `c`",
		validate: (message: Message) => {
			return message.content.toLowerCase() === "inc" || message.content.toLowerCase() === "i" || message.content.toLowerCase() === "all" || message.content.toLowerCase() === "c";
		},
		response: (message: Message) => {
			if (message.content.toLowerCase() === "inc" || message.content.toLowerCase() === "i") {
				return `Set role system to incremental.`;
			} else {
				return `Set role system to cumulative.`;
			}
		},
		handle: (setting: ServerSetting, message: Message) => {
			if (message.content.toLowerCase() === "inc" || message.content.toLowerCase() === "i") {
				setting.roles = "highest";
			} else {
				setting.roles = "all";
			}
		}
	},
	{
		question: "Please set a channel for bot updates.",
		description: "The bot will send a message to that channel whenever important updates are released. It's recommended to use your staff channel here.\nPlease respond with a channel mention or id.",
		validate: (message: Message) => {
			return message.guild?.channels.cache.has(getChannelId(message.content));
		},
		response: (message: Message) => {
			return `Set update channel to <#${getChannelId(message.content)}>.`;
		},
		handle: (setting: ServerSetting, message: Message) => {
			setting.update_channel_id = getChannelId(message.content);
		}
	}
];

export function startDialog(message: Message) {
	if (!message.member || !message.member.permissions.has(PermissionFlagsBits.ManageRoles)) {
		message.reply({
			embeds: [{
				title: "Setup failed",
				description: "You need the `Manage Roles` permission to use this command.",
				color: 0xff0000
			}]
		}).catch(() => {});
		return;
	}
	dialogues[message.guild?.id + ":" + message.author.id + ":" + message.channel.id] = {data: getDefaults(), step: 0};
	sendStep(message, undefined);
}

export function hasDialog(message: Message) {
	return dialogues.hasOwnProperty(message.guild?.id + ":" + message.author.id + ":" + message.channel.id);
}

export function handleDialog(message: Message) {
	let dialogue = dialogues[message.guild?.id + ":" + message.author.id + ":" + message.channel.id];
	if (message.content.toLowerCase() === "cancel") {
		delete dialogues[message.guild?.id + ":" + message.author.id + ":" + message.channel.id];
		message.reply({
			embeds: [{
				title: "Setup cancelled",
				description: "The setup has been cancelled.",
				color: 0xff0000
			}]
		}).catch(console.error);
		return;
	}
	if (!steps[dialogue.step].validate(message)) {
		message.reply({
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
		delete dialogues[message.guild?.id + ":" + message.author.id + ":" + message.channel.id];
		if (!message.guild) {
			message.reply({
				embeds: [{
					title: "Setup failed",
					description: "Something went wrong. Please try again.",
					color: 0xff0000
				}]
			}).catch(console.error);
			return;
		}
		dialogue.data.guild_id = message.guild.id;
		setServerSetting(dialogue.data);
		rewards.loadRewards(dialogue.data);
		message.reply({
			embeds: [{
				title: "Setup finished",
				description: `The setup has been finished. Settings can be changed using \`${dialogue.data.prefix}settings\` at any point.\nIf you want to setup reward roles, you can do it there as well.`,
				color: 0x00ff00
			}]
		}).catch(console.error);
		return;
	}
	sendStep(message, steps[dialogue.step - 1].response(message));
}

function sendStep(message: Message, extra?: string) {
	let dialogue = dialogues[message.guild?.id + ":" + message.author.id + ":" + message.channel.id];
	message.reply({
		content: extra,
		embeds: [{
			title: steps[dialogue.step].question,
			description: steps[dialogue.step].description,
			color: 0x00ff00,
			footer: {
				text: "Write your answer into this chat - Type \"cancel\" to cancel the setup."
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