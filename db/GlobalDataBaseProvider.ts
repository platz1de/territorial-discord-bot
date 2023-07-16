import {GuildMember, Snowflake} from "discord.js";
import {Database} from "sqlite3";
import {DataBaseResponse} from "./DataBaseManager";
import {rewards} from "../PointManager";
import {ServerSetting} from "../BotSettingProvider";

class GlobalDataBaseProvider {
	db: Database;

	constructor(db: Database) {
		this.db = db;
	}

	async getPoints(setting: ServerSetting, member: GuildMember): Promise<number> {
		return await this.getData(setting, member).then((data) => data.points);
	}

	async getWins(setting: ServerSetting, member: GuildMember): Promise<number> {
		return await this.getData(setting, member).then((data) => data.wins);
	}

	async getData(setting: ServerSetting, member: GuildMember): Promise<{ points: number, wins: number }> {
		return new Promise((resolve, reject) => {
			this.db.get<{ points: number, wins: number }>("SELECT points, wins FROM global_points WHERE guild = ? AND member = ?", [setting.guild_id, member.id], (err, row) => {
				if (err) {
					reject(err);
				} else {
					resolve(row || {points: 0, wins: 0});
				}
			});
		});
	}

	async getTotalData(setting: ServerSetting): Promise<{ points: number, wins: number }> {
		return new Promise((resolve, reject) => {
			this.db.get<{ points: number, wins: number }>("SELECT SUM(points) AS points, SUM(wins) AS wins FROM global_points WHERE guild = ?", [setting.guild_id], (err, row) => {
				if (err) {
					reject(err);
				} else {
					resolve(row || {points: 0, wins: 0});
				}
			});
		});
	}

	async modifyPoints(setting: ServerSetting, member: GuildMember, points: number) {
		return points > 0 ? this.addPoints(setting, member, points) : this.removePoints(setting, member, -points);
	}

	async modifyWins(setting: ServerSetting, member: GuildMember, wins: number) {
		return wins > 0 ? this.addWins(setting, member, wins) : this.removeWins(setting, member, -wins);
	}

	async addPoints(setting: ServerSetting, member: GuildMember, points: number) {
		return this.addData(setting, member, points, 0);
	}

	async addWins(setting: ServerSetting, member: GuildMember, wins: number) {
		return this.addData(setting, member, 0, wins);
	}

	async addData(setting: ServerSetting, member: GuildMember, points: number, wins: number): Promise<DataBaseResponse> {
		if (isNaN(points) || isNaN(wins)) return {success: false, error: "Invalid number"};
		points = Math.max(0, Math.round(points));
		wins = Math.max(0, Math.round(wins));
		return new Promise((resolve, reject) => {
			this.db.get<{ points: number, wins: number }>("INSERT INTO global_points (guild, member, points, wins) VALUES (?, ?, ?, ?) ON CONFLICT (guild, member) DO UPDATE SET points = points + ?, wins = wins + ? RETURNING points, wins", [setting.guild_id, member.id, points, wins, points, wins], (err, row) => {
				if (err) {
					reject(err);
				} else {
					resolve({success: true, reward: rewards.checkChanges(setting, member, "points", row.points - points, row.points).concat(rewards.checkChanges(setting, member, "wins", row.wins - wins, row.wins))});
				}
			});
		});
	}

	async removePoints(setting: ServerSetting, member: GuildMember, points: number) {
		return this.removeData(setting, member, points, 0);
	}

	async removeWins(setting: ServerSetting, member: GuildMember, wins: number) {
		return this.removeData(setting, member, 0, wins);
	}

	async removeData(setting: ServerSetting, member: GuildMember, points: number, wins: number): Promise<DataBaseResponse> {
		if (isNaN(points) || isNaN(wins)) return {success: false, error: "Invalid number"};
		let data = await this.getData(setting, member);
		points = Math.max(0, Math.min(Math.round(points), data.points));
		wins = Math.max(0, Math.min(Math.round(wins), data.wins));
		return new Promise((resolve, reject) => {
			this.db.get<{ points: number, wins: number }>("INSERT INTO global_points (guild, member, points, wins) VALUES (?, ?, 0, 0) ON CONFLICT (guild, member) DO UPDATE SET points = MAX(0, points - ?), wins = MAX(0, wins - ?) RETURNING points, wins", [setting.guild_id, member.id, points, wins], (err, row) => {
				if (err) {
					reject(err);
				} else {
					resolve({success: true, reward: rewards.checkChanges(setting, member, "points", row.points + points, row.points).concat(rewards.checkChanges(setting, member, "wins", row.wins + wins, row.wins))});
				}
			});
		});
	}

	async getPointRank(setting: ServerSetting, member: GuildMember): Promise<number> {
		return new Promise((resolve, reject) => {
			this.db.get<{ rank: number }>("SELECT COUNT(*) AS rank FROM global_points WHERE guild = ? AND points > IFNULL((SELECT points FROM global_points WHERE guild = ? AND member = ?), 0)", [setting.guild_id, setting.guild_id, member.id], (err, row) => {
				if (err) {
					reject(err);
				} else {
					resolve(row.rank + 1);
				}
			});
		});
	}

	async getWinRank(setting: ServerSetting, member: GuildMember): Promise<number> {
		return new Promise((resolve, reject) => {
			this.db.get<{ rank: number }>("SELECT COUNT(*) AS rank FROM global_points WHERE guild = ? AND wins > IFNULL((SELECT wins FROM global_points WHERE guild = ? AND member = ?), 0)", [setting.guild_id, setting.guild_id, member.id], (err, row) => {
				if (err) {
					reject(err);
				} else {
					resolve(row.rank + 1);
				}
			});
		});
	}

	async getEntryCount(setting: ServerSetting): Promise<number> {
		return new Promise((resolve, reject) => {
			this.db.get<{ count: number }>("SELECT COUNT(*) AS count FROM global_points WHERE guild = ?", [setting.guild_id], (err, row) => {
				if (err) {
					reject(err);
				} else {
					resolve(row ? row.count : 0);
				}
			});
		});
	}

	async getPointLeaderboard(setting: ServerSetting, page: number): Promise<{ member: Snowflake, points: number }[]> {
		if (isNaN(page)) page = 1;
		page = Math.max(1, Math.floor(page)) - 1;
		return new Promise((resolve, reject) => {
			this.db.all<{ member: Snowflake, points: number }>("SELECT member, points FROM global_points WHERE guild = ? ORDER BY points DESC LIMIT 10 OFFSET ?", [setting.guild_id, page * 10], (err, rows) => {
				if (err) {
					reject(err);
				} else {
					resolve(rows);
				}
			});
		});
	}

	async getWinLeaderboard(setting: ServerSetting, page: number): Promise<{ member: Snowflake, wins: number }[]> {
		if (isNaN(page)) page = 1;
		page = Math.max(1, page) - 1;
		return new Promise((resolve, reject) => {
			this.db.all<{ member: Snowflake, wins: number }>("SELECT member, wins FROM global_points WHERE guild = ? ORDER BY wins DESC LIMIT 10 OFFSET ?", [setting.guild_id, page * 10], (err, rows) => {
				if (err) {
					reject(err);
				} else {
					resolve(rows);
				}
			});
		});
	}
}

export default GlobalDataBaseProvider;