import * as fs from "fs";
import {Snowflake} from "discord.js";
import {rewards} from "./PointManager";
import {BotUserContext} from "./util/BotUserContext";

export interface ServerSetting {
	roles: "all" | "highest",
	guild_id: string,
	channel_id: Snowflake[],
	log_channel_id: string,
	update_channel_id: string,
	prefix: string,
	mod_roles: Snowflake[],
	rewards: { role_id: string, type: "points" | "wins", count: number }[],
	multiplier: { amount: number, end: number | null, description: string } | null
}

const settings: ServerSetting[] = require("./settings.json");
const indices: { [key: Snowflake]: number } = {};
export const defaultSetting: ServerSetting = {roles: "all", guild_id: "", channel_id: [], log_channel_id: "", update_channel_id: "", prefix: "!", mod_roles: [], rewards: [], multiplier: null};

for (const i in settings) {
	indices[settings[i].guild_id] = parseInt(i);
	rewards.loadRewards(settings[i]);
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
	if (indices.hasOwnProperty(setting.guild_id)) {
		settings[indices[setting.guild_id]] = setting;
	} else {
		settings.push(setting);
		indices[setting.guild_id] = settings.length - 1;
	}
	updateSettings();
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