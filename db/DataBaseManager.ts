import * as sqlite3 from "sqlite3";

const db = new sqlite3.Database("./ranking.db");
const settings = require("../BotSettingProvider");

db.run("CREATE TABLE IF NOT EXISTS global_points (guild TEXT, member TEXT, points INTEGER, wins INTEGER, PRIMARY KEY (guild, member))");
db.run("CREATE TABLE IF NOT EXISTS daily_points (guild TEXT, member TEXT, day INTEGER, points INTEGER, wins INTEGER, PRIMARY KEY (guild, member, day))");

export function getProvider(): sqlite3.Database {
	return db;
}

export function getSettingProvider() {
	return settings;
}