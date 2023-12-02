import * as fs from "fs";
import {Snowflake} from "discord.js";
import {rewards} from "./PointManager";
import {BotUserContext} from "./util/BotUserContext";
import {subscribe} from "./util/GameDataDistributor";

export interface ServerSetting {
	roles: "all" | "highest",
	auto_points: boolean,
	guild_id: string,
	tag: string | null,
	channel_id: Snowflake[],
	log_channel_id: string,
	update_channel_id: string,
	mod_roles: Snowflake[],
	rewards: { role_id: string, type: "points" | "wins", count: number }[],
	multiplier: { amount: number, end: number | null, description: string } | null,
	webhooks: { clan: string, url: string, channel: Snowflake }[],
	win_feed: Snowflake | null,
	claim_channel: Snowflake | null,
	claim_channel_description: string | null,
	factor_buttons: { name: string, factor: number }[],
	status: number // first bit: 1 = points imported from 3rd party
}

const settings: ServerSetting[] = require("./settings.json");
const indices: { [key: Snowflake]: number } = {};
const clanCache: { [key: string]: Snowflake[] } = {};

for (const i in settings) {
	if (!settings[i].status) settings[i].status = 0;
	if (!settings[i].auto_points) settings[i].auto_points = false;
	if (!settings[i].webhooks) settings[i].webhooks = [];
	if (!settings[i].win_feed) settings[i].win_feed = null;
	if (!settings[i].claim_channel) settings[i].claim_channel = null;
	if (!settings[i].claim_channel_description) settings[i].claim_channel_description = null;
	if (!settings[i].factor_buttons) settings[i].factor_buttons = [];
	if (!settings[i].tag) settings[i].tag = null;
	indices[settings[i].guild_id] = parseInt(i);

	let tag = settings[i].tag;
	if (tag !== null) {
		if (!clanCache.hasOwnProperty(tag)) {
			clanCache[tag] = [];
		}
		clanCache[tag].push(settings[i].guild_id);
	}

	rewards.loadRewards(settings[i]);
	for (const webhook of settings[i].webhooks) {
		subscribe(webhook.clan, webhook.url);
	}
}

export function getDefaults(): ServerSetting {
	return {roles: "all", auto_points: false, guild_id: "", tag: null, channel_id: [], log_channel_id: "", update_channel_id: "", mod_roles: [], rewards: [], multiplier: null, webhooks: [], win_feed: null, claim_channel: null, claim_channel_description: null, factor_buttons: [], status: 0};
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

export function updateClanTag(context: ServerSetting, tag: string | null) {
	if (context.tag === tag) return;
	if (context.tag !== null && clanCache.hasOwnProperty(context.tag)) {
		clanCache[context.tag].splice(clanCache[context.tag].indexOf(context.guild_id), 1);
	}
	context.tag = tag;
	if (tag !== null) {
		if (!clanCache.hasOwnProperty(tag)) {
			clanCache[tag] = [];
		}
		clanCache[tag].push(context.guild_id);
	}
	updateSettings();
}

export function getGuildsForClan(clan: string): Snowflake[] {
	if (clanCache.hasOwnProperty(clan)) {
		return clanCache[clan];
	}
	return [];
}