import * as sqlite3 from "sqlite3";
import {GuildMember} from "discord.js";
import GlobalDataBaseProvider from "./GlobalDataBaseProvider";
import DailyDataBaseProvider from "./DailyDataBaseProvider";
import {RewardAnswer} from "../util/RewardManager";
import {ServerSetting} from "../BotSettingProvider";

const db = new sqlite3.Database("./ranking.db");
const settings = require("../BotSettingProvider");

db.run("CREATE TABLE IF NOT EXISTS global_points (guild TEXT, member TEXT, points INTEGER, wins INTEGER, PRIMARY KEY (guild, member))");
db.run("CREATE TABLE IF NOT EXISTS daily_points (guild TEXT, member TEXT, day INTEGER, points INTEGER, wins INTEGER, PRIMARY KEY (guild, member, day))");

const globalProvider = new GlobalDataBaseProvider(db);
const dailyProvider = new DailyDataBaseProvider(db);

interface DataBaseResponse {
	success: boolean,
	error?: string,
	reward?: RewardAnswer[]
}

function getGlobalProvider(): GlobalDataBaseProvider {
	return globalProvider;
}

function getDailyProvider(): DailyDataBaseProvider {
	return dailyProvider;
}

function getSettingProvider() {
	return settings;
}

export {getGlobalProvider, getDailyProvider, DataBaseResponse, getSettingProvider};

/**
 * Combined functions follow
 */

async function registerWin(setting: ServerSetting, member: GuildMember, points: number): Promise<DataBaseResponse> {
	const globalResponse = await getGlobalProvider().addData(setting, member, points, 1);
	await getDailyProvider().addData(setting, member, points, 1);

	return {success: globalResponse.success, reward: globalResponse.reward || []};
}

async function removeWin(setting: ServerSetting, member: GuildMember, points: number): Promise<DataBaseResponse> {
	const globalResponse = await getGlobalProvider().removeData(setting, member, points, 1);
	await getDailyProvider().removeData(setting, member, points, 1);

	return {success: globalResponse.success, reward: globalResponse.reward || []};
}

async function modifyPoints(setting: ServerSetting, member: GuildMember, points: number): Promise<DataBaseResponse> {
	if (isNaN(points) || points === 0) return {success: false, error: "Invalid points"};
	const globalResponse = await getGlobalProvider().modifyPoints(setting, member, points);
	await getDailyProvider().modifyPoints(setting, member, points);

	return {success: globalResponse.success, reward: globalResponse.reward || []};
}

async function modifyWins(setting: ServerSetting, member: GuildMember, wins: number): Promise<DataBaseResponse> {
	if (isNaN(wins) || wins === 0) return {success: false, error: "Invalid wins"};
	const globalResponse = await getGlobalProvider().modifyWins(setting, member, wins);
	await getDailyProvider().modifyWins(setting, member, wins);

	return {success: globalResponse.success, reward: globalResponse.reward || []};
}

export {registerWin, removeWin, modifyPoints, modifyWins};