import BotInteraction from "./BotInteraction";
import {defaultSetting, ServerSetting, setServerSetting} from "../BotSettingProvider";
import { PermissionFlagsBits } from "discord.js";
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
		validate: (interaction: BotInteraction, message: string) => {
			return message.length > 0 && message.length < 10;
		},
		response: (message: string) => {
			return `Set prefix to \`${message}\` for command usage like \`${message}help\`.`;
		},
		handle: (setting: ServerSetting, message: string) => {
			setting.prefix = message;
		}
	},
	{
		question: "What is your win submission channel?",
		description: "The bot will only listen to point commands in that channel. You can add more channels later.\nProfile and leaderboard commands will always work in every channel.\nPlease respond with a channel mention or id.",
		validate: (interaction: BotInteraction, message: string) => {
			if (message.startsWith("<#") && message.endsWith(">")) {
				message = message.substring(2, message.length - 1);
			}
			return interaction.guild.channels.cache.has(message);
		},
		response: (message: string) => {
			if (message.startsWith("<#") && message.endsWith(">")) {
				message = message.substring(2, message.length - 1);
			}
			return `Set win submission channel to <#${message}>.`;
		},
		handle: (setting: ServerSetting, message: string) => {
			if (message.startsWith("<#") && message.endsWith(">")) {
				message = message.substring(2, message.length - 1);
			}
			setting.channel_id.push(message);
		}
	},
	{
		question: "What is your log channel?",
		description: "The bot will send a message to that channel whenever moderator commands are used.\nPlease respond with a channel mention or id.",
		validate: (interaction: BotInteraction, message: string) => {
			if (message.startsWith("<#") && message.endsWith(">")) {
				message = message.substring(2, message.length - 1);
			}
			return interaction.guild.channels.cache.has(message);
		},
		response: (message: string) => {
			if (message.startsWith("<#") && message.endsWith(">")) {
				message = message.substring(2, message.length - 1);
			}
			return `Set log channel to <#${message}>.`;
		},
		handle: (setting: ServerSetting, message: string) => {
			if (message.startsWith("<#") && message.endsWith(">")) {
				message = message.substring(2, message.length - 1);
			}
			setting.log_channel_id = message;
		}
	},
	{
		question: "What is your role for moderators?",
		description: "Users with this role will be able to use moderator commands. You can add more roles later.\nPlease respond with a role mention or id.",
		validate: (interaction: BotInteraction, message: string) => {
			if (message.startsWith("<@&") && message.endsWith(">")) {
				message = message.substring(3, message.length - 1);
			}
			return interaction.guild.roles.cache.has(message);
		},
		response: (message: string) => {
			if (message.startsWith("<@&") && message.endsWith(">")) {
				message = message.substring(3, message.length - 1);
			}
			return `Set moderator role to <@&${message}>.`;
		},
		handle: (setting: ServerSetting, message: string) => {
			if (message.startsWith("<@&") && message.endsWith(">")) {
				message = message.substring(3, message.length - 1);
			}
			setting.mod_roles.push(message);
		}
	},
	{
		question: "Is your role system incremental or cumulative?",
		description: "Incremental: Users will only get the highest role they have enough points for. Answer with `inc` or `i`\nCumulative: Users will get all roles they have enough points for. Answer with `all` or `c`",
		validate: (interaction: BotInteraction, message: string) => {
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
		validate: (interaction: BotInteraction, message: string) => {
			if (message.startsWith("<#") && message.endsWith(">")) {
				message = message.substring(2, message.length - 1);
			}
			return interaction.guild.channels.cache.has(message);
		},
		response: (message: string) => {
			if (message.startsWith("<#") && message.endsWith(">")) {
				message = message.substring(2, message.length - 1);
			}
			return `Set update channel to <#${message}>.`;
		},
		handle: (setting: ServerSetting, message: string) => {
			if (message.startsWith("<#") && message.endsWith(">")) {
				message = message.substring(2, message.length - 1);
			}
			setting.update_channel_id = message;
		}
	}
];

export function startDialog(interaction: BotInteraction) {
	let member = interaction.guild.members.cache.get(interaction.user.id);
	if (!member || !member.permissions.has(PermissionFlagsBits.ManageRoles)) {
		interaction.reply({
			embeds: [{
				title: "Setup failed",
				description: "You need the `Manage Roles` permission to use this command.",
				color: 0xff0000
			}]
		});
		return;
	}
	dialogues[interaction.guild.id + ":" + interaction.user.id + ":" + interaction.channel.id] = {data: defaultSetting, step: 0};
	sendStep(interaction, undefined);
}

export function hasDialog(interaction: BotInteraction) {
	return dialogues.hasOwnProperty(interaction.guild.id + ":" + interaction.user.id + ":" + interaction.channel.id);
}

export function handleDialog(interaction: BotInteraction, message: string) {
	let dialogue = dialogues[interaction.guild.id + ":" + interaction.user.id + ":" + interaction.channel.id];
	if (message.toLowerCase() === "cancel") {
		delete dialogues[interaction.guild.id + ":" + interaction.user.id + ":" + interaction.channel.id];
		interaction.reply({
			embeds: [{
				title: "Setup cancelled",
				description: "The setup has been cancelled.",
				color: 0xff0000
			}]
		}).catch(console.error);
		return;
	}
	if (!steps[dialogue.step].validate(interaction, message)) {
		interaction.reply({
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
		delete dialogues[interaction.guild.id + ":" + interaction.user.id + ":" + interaction.channel.id];
		dialogue.data.guild_id = interaction.guild.id;
		setServerSetting(dialogue.data);
		rewards.loadRewards(dialogue.data);
		interaction.reply({
			embeds: [{
				title: "Setup finished",
				description: `The setup has been finished. Settings can be changed using \`${dialogue.data.prefix}settings\` at any point.\nIf you want to setup reward roles, you can do it there as well.`,
				color: 0x00ff00
			}]
		}).catch(console.error);
		return;
	}
	sendStep(interaction, steps[dialogue.step - 1].response(message));
}

function sendStep(interaction: BotInteraction, message?: string) {
	let dialogue = dialogues[interaction.guild.id + ":" + interaction.user.id + ":" + interaction.channel.id];
	interaction.reply({
		content: message,
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