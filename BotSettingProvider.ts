import * as fs from "fs";
import {Snowflake} from "discord.js";
import {rewards} from "./PointManager";
import {BotUserContext} from "./util/BotUserContext";
import {subscribe} from "./util/GameDataDistributor";

export interface ServerSetting {
	roles: "all" | "highest",
	auto_points: boolean,
	guild_id: string,
	channel_id: Snowflake[],
	log_channel_id: string,
	update_channel_id: string,
	mod_roles: Snowflake[],
	rewards: { role_id: string, type: "points" | "wins", count: number }[],
	multiplier: { amount: number, end: number | null, description: string } | null,
	webhooks: { clan: string, url: string, channel: Snowflake }[],
	win_feed: Snowflake | null,
	status: number // first bit: 1 = points imported from 3rd party
}

const settings: ServerSetting[] = require("./settings.json");
const indices: { [key: Snowflake]: number } = {};

for (const i in settings) {
	if (!settings[i].status) settings[i].status = 0;
	if (!settings[i].auto_points) settings[i].auto_points = false;
	if (!settings[i].webhooks) settings[i].webhooks = [];
	if (!settings[i].win_feed) settings[i].win_feed = null;
	indices[settings[i].guild_id] = parseInt(i);
	rewards.loadRewards(settings[i]);
	for (const webhook of settings[i].webhooks) {
		subscribe(webhook.clan, webhook.url);
	}
}

export function getDefaults(): ServerSetting {
	return {roles: "all", auto_points: false, guild_id: "", channel_id: [], log_channel_id: "", update_channel_id: "", mod_roles: [], rewards: [], multiplier: null, webhooks: [], win_feed: null, status: 0};
}

function updateSettings() {
	fs.writeFile("./settings.json", JSON.stringify(settings, null, 4), (err) => {
		if (err) {
			console.error(err);
		}
	});
}

export function getServerContext(guild: Snowflake): ServerSetting | null {
	if (indices.hasOwnProperty(guild)) {
		return settings[indices[guild]];
	}
	return null;
}

export function setServerSetting(setting: ServerSetting) {
	if (!indices.hasOwnProperty(setting.guild_id)) {
		indices[setting.guild_id] = Object.keys(indices).length;
		console.log(`Added new server ${setting.guild_id} at index ${settings.length}`);
	}
	settings[indices[setting.guild_id]] = setting;
	updateSettings();
}

export function removeServerSetting(guild: Snowflake) {
	if (indices.hasOwnProperty(guild)) {
		settings.splice(indices[guild], 1);
		delete indices[guild];
		updateSettings();
		for (const i in settings) {
			indices[settings[i].guild_id] = parseInt(i);
		}
	}
}

export function getMultiplier(context: BotUserContext): { amount: number, end: number | null, description: string } | null {
	if (context.context.multiplier === null) return null;
	if (context.context.multiplier.end !== null && context.context.multiplier.end < Date.now()) {
		context.context.multiplier = null;
		updateSettings();
	}
	return context.context.multiplier;
}

export function setMultiplier(context: BotUserContext, amount: number, end: number | null, description: string) {
	context.context.multiplier = {amount, end, description};
	updateSettings();
}

export function clearMultiplier(context: BotUserContext) {
	context.context.multiplier = null;
	updateSettings();
}