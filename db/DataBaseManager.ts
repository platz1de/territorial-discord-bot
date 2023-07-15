import * as sqlite3 from "sqlite3";
import {GuildMember} from "discord.js";
import GlobalDataBaseProvider from "./GlobalDataBaseProvider";
import DailyDataBaseProvider from "./DailyDataBaseProvider";
import {RewardAnswer} from "../util/RewardManager";

const db = new sqlite3.Database("./ranking.db");
const settings = require("../BotSettingProvider");

db.run("CREATE TABLE IF NOT EXISTS global_points (member TEXT PRIMARY KEY, points INTEGER, wins INTEGER)");
db.run("CREATE TABLE IF NOT EXISTS daily_points (member TEXT, day INTEGER, points INTEGER, wins INTEGER, PRIMARY KEY (member, day))");

interface DataBaseResponse {
	success: boolean,
	error?: string,
	reward?: RewardAnswer[]
}

function getGlobalProvider(): GlobalDataBaseProvider {
	return new GlobalDataBaseProvider(db);
}

function getDailyProvider(): DailyDataBaseProvider {
	return new DailyDataBaseProvider(db);
}

function getSettingProvider() {
	return settings;
}

export {getGlobalProvider, getDailyProvider, DataBaseResponse, getSettingProvider};

/**
 * Combined functions follow
 */

async function registerWin(member: GuildMember, points: number): Promise<DataBaseResponse> {
	const globalResponse = await getGlobalProvider().addData(member, points, 1);
	await getDailyProvider().addData(member, points, 1);

	return {success: globalResponse.success, reward: globalResponse.reward || []};
}

async function removeWin(member: GuildMember, points: number): Promise<DataBaseResponse> {
	const globalResponse = await getGlobalProvider().removeData(member, points, 1);
	await getDailyProvider().removeData(member, points, 1);

	return {success: globalResponse.success, reward: globalResponse.reward || []};
}

async function modifyPoints(member: GuildMember, points: number): Promise<DataBaseResponse> {
	if (isNaN(points) || points === 0) return {success: false, error: "Invalid points"};
	const globalResponse = await getGlobalProvider().modifyPoints(member, points);
	await getDailyProvider().modifyPoints(member, points);

	return {success: globalResponse.success, reward: globalResponse.reward || []};
}

async function modifyWins(member: GuildMember, wins: number): Promise<DataBaseResponse> {
	if (isNaN(wins) || wins === 0) return {success: false, error: "Invalid wins"};
	const globalResponse = await getGlobalProvider().modifyWins(member, wins);
	await getDailyProvider().modifyWins(member, wins);

	return {success: globalResponse.success, reward: globalResponse.reward || []};
}

export {registerWin, removeWin, modifyPoints, modifyWins};