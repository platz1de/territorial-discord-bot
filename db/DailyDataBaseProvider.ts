import {GuildMember, Snowflake} from "discord.js";
import {Database} from "sqlite3";

class DailyDataBaseProvider {
	db: Database;

	constructor(db: Database) {
		this.db = db;
	}

	async getPoints(member: GuildMember): Promise<number> {
		return await this.getData(member).then((data) => data.points);
	}

	async getWins(member: GuildMember): Promise<number> {
		return await this.getData(member).then((data) => data.wins);
	}

	async getData(member: GuildMember): Promise<{ points: number, wins: number }> {
		return new Promise((resolve, reject) => {
			this.db.get<{ points: number, wins: number }>("SELECT points, wins FROM daily_points WHERE member = ? AND day = date()", [member.id], (err, row) => {
				if (err) {
					reject(err);
				} else {
					resolve(row || {points: 0, wins: 0});
				}
			});
		});
	}

	async modifyPoints(member: GuildMember, points: number) {
		return points > 0 ? this.addPoints(member, points) : this.removePoints(member, -points);
	}

	async modifyWins(member: GuildMember, wins: number) {
		return wins > 0 ? this.addWins(member, wins) : this.removeWins(member, -wins);
	}

	async addPoints(member: GuildMember, points: number) {
		return this.addData(member, points, 0);
	}

	async addWins(member: GuildMember, wins: number) {
		return this.addData(member, 0, wins);
	}

	async addData(member: GuildMember, points: number, wins: number) {
		if (isNaN(points) || isNaN(wins)) return;
		points = Math.max(0, Math.round(points));
		wins = Math.max(0, Math.round(wins));
		this.db.run("INSERT INTO daily_points (member, day, points, wins) VALUES (?, date(), ?, ?) ON CONFLICT (member, day) DO UPDATE SET points = points + ?, wins = wins + ?", [member.id, points, wins, points, wins]);
	}

	async removePoints(member: GuildMember, points: number) {
		return this.removeData(member, points, 0);
	}

	async removeWins(member: GuildMember, wins: number) {
		return this.removeData(member, 0, wins);
	}

	async removeData(member: GuildMember, points: number, wins: number) {
		if (isNaN(points) || isNaN(wins)) return;
		points = Math.max(0, Math.round(points));
		wins = Math.max(0, Math.round(wins));
		this.db.run("INSERT INTO daily_points (member, day, points, wins) VALUES (?, date(), 0, 0) ON CONFLICT (member, day) DO UPDATE SET points = MAX(0, points - ?), wins = MAX(0, wins - ?)", [member.id, points, wins]);
	}

	async getEntryCount(duration: number): Promise<number> {
		if (isNaN(duration)) duration = 7;
		duration = Math.min(30, Math.max(1, Math.floor(duration)));
		return new Promise((resolve, reject) => {
			this.db.get<{ count: number }>("SELECT COUNT(*) AS count FROM daily_points WHERE day >= date('now', ? || ' days') GROUP BY member", [-duration], (err, row) => {
				if (err) {
					reject(err);
				} else {
					resolve(row ? row.count : 0);
				}
			});
		});
	}

	async getPointLeaderboard(duration: number, page: number): Promise<{ member: Snowflake, points: number }[]> {
		if (isNaN(page)) page = 1;
		page = Math.max(1, Math.floor(page)) - 1;
		if (isNaN(duration)) duration = 7;
		duration = Math.min(30, Math.max(1, Math.floor(duration)));
		return new Promise((resolve, reject) => {
			this.db.all<{ member: Snowflake, points: number }>("SELECT member, SUM(points) AS points FROM daily_points WHERE day >= date('now', ? || ' days') GROUP BY member ORDER BY points DESC LIMIT 10 OFFSET ?", [-duration, page * 10], (err, rows) => {
				if (err) {
					reject(err);
				} else {
					resolve(rows);
				}
			});
		});
	}

	async getWinLeaderboard(duration: number, page: number): Promise<{ member: Snowflake, wins: number }[]> {
		if (isNaN(page)) page = 1;
		page = Math.max(1, Math.floor(page)) - 1;
		if (isNaN(duration)) duration = 7;
		duration = Math.min(30, Math.max(1, Math.floor(duration)));
		return new Promise((resolve, reject) => {
			this.db.all<{ member: Snowflake, wins: number }>("SELECT member, SUM(wins) AS wins FROM daily_points WHERE day >= date('now', ? || ' days') GROUP BY member ORDER BY wins DESC LIMIT 10 OFFSET ?", [-duration, page * 10], (err, rows) => {
				if (err) {
					reject(err);
				} else {
					resolve(rows);
				}
			});
		});
	}

	async getLegacyData(member: GuildMember, duration: number): Promise<{ day: string, points: number, wins: number }[]> {
		if (isNaN(duration)) duration = 7;
		duration = Math.min(30, Math.max(1, Math.floor(duration)));
		return new Promise((resolve, reject) => {
			this.db.all<{ day: string, points: number, wins: number }>("SELECT day, points, wins FROM daily_points WHERE member = ? AND day >= date('now', ? || ' days') ORDER BY day DESC", [member.id, -duration], (err, rows) => {
				if (err) {
					reject(err);
				} else {
					//Add missing days
					let data: { day: string, points: number, wins: number }[] = [];
					let date = new Date();
					date.setHours(0, 0, 0, 0);
					for (let i = 0; i < duration; i++) {
						let day = date.toISOString().split("T")[0];
						let entry = rows.find((entry) => entry.day === day);
						data.push(entry || {day: day, points: 0, wins: 0});
						date.setDate(date.getDate() - 1);
					}
					resolve(data.reverse());
				}
			});
		});
	}
}

export default DailyDataBaseProvider;