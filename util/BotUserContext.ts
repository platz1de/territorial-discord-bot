import {BaseMessageOptions, ChatInputCommandInteraction, Guild, GuildMember, Message, MessagePayload, Snowflake, TextBasedChannel, User} from "discord.js";
import {Database} from "sqlite3";
import {client, db, rewards} from "../PointManager";
import {getServerContext, ServerSetting} from "../BotSettingProvider";
import {RewardAnswer} from "./RewardManager";

export class BotUserContext {
	id: Snowflake;
	db: Database;
	context: ServerSetting;
	base: Message | ChatInputCommandInteraction | null;
	last: Message | undefined;
	user: User;
	member: GuildMember | undefined;
	guild: Guild;
	channel: TextBasedChannel | undefined;

	constructor(id: Snowflake, context: ServerSetting, base: Message | ChatInputCommandInteraction | null) {
		this.id = id;
		this.db = db.getProvider();
		this.context = context;
		this.base = base;
		if (base && base.guild) {
			this.guild = base.guild;
		} else {
			this.guild = client.guilds.cache.get(context.guild_id) as Guild;
		}
		if (base instanceof ChatInputCommandInteraction) this.user = base.user;
		else if (base) this.user = base.author;
		else this.user = client.user as User; //Dummy user
		if (base && base.member) this.member = base.member as GuildMember;
		if (base && base.channel) {
			this.channel = base.channel;
		}
	}

	fetchMember(): Promise<void> {
		return new Promise(resolve => {
			if (this.member) {
				resolve();
			} else {
				this.guild.members.fetch(this.id).then(member => {
					this.user = member.user;
					this.member = member;
					resolve();
				}).catch(() => {
					resolve();
				});
			}
		});
	}

	async reply(message: string | MessagePayload | BaseMessageOptions): Promise<Message> {
		if (!this.base) throw new Error("Base not found");
		if (this.base instanceof ChatInputCommandInteraction) {
			return await this.base.editReply(message);
		} else {
			if (this.last) {
				return await this.last.edit(message);
			} else {
				return this.last = await this.base.reply(message);
			}
		}
	}

	hasModAccess(): boolean {
		if (!this.member) return false;
		for (const role of this.member.roles.cache.values() || []) {
			if (this.context.mod_roles.includes(role.id)) {
				return true;
			}
		}
		return false;
	}

	async registerWin(points: number): Promise<RewardAnswer[]> {
		await this.modifyDailyData(points, 1);
		return this.modifyAllTimeData(points, 1);
	}

	async removeWin(points: number): Promise<RewardAnswer[]> {
		await this.modifyDailyData(-points, -1);
		return this.modifyAllTimeData(-points, -1);
	}

	async modifyPoints(points: number): Promise<RewardAnswer[]> {
		await this.modifyDailyData(points, 0);
		return this.modifyAllTimeData(points, 0);
	}

	async modifyWins(wins: number): Promise<RewardAnswer[]> {
		await this.modifyDailyData(0, wins);
		return this.modifyAllTimeData(0, wins);
	}

	async getData(): Promise<{ points: number, wins: number }> {
		return new Promise((resolve, reject) => {
			this.db.get<{ points: number, wins: number }>("SELECT points, wins FROM global_points WHERE guild = ? AND member = ?", [this.context.guild_id, this.id], (err, row) => {
				if (err) {
					reject(err);
				} else {
					resolve(row || {points: 0, wins: 0});
				}
			});
		});
	}

	async getTotalData(): Promise<{ points: number, wins: number }> {
		return new Promise((resolve, reject) => {
			this.db.get<{ points: number, wins: number }>("SELECT SUM(points) AS points, SUM(wins) AS wins FROM global_points WHERE guild = ?", [this.context.guild_id], (err, row) => {
				if (err) {
					reject(err);
				} else {
					resolve(row || {points: 0, wins: 0});
				}
			});
		});
	}

	async modifyAllTimeData(points: number, wins: number): Promise<RewardAnswer[]> {
		if (isNaN(points) || isNaN(wins)) throw new Error("Invalid number");
		points = Math.round(points);
		wins = Math.round(wins);
		return new Promise((resolve, reject) => {
			this.db.get<{ points: number, wins: number }>("INSERT INTO global_points (guild, member, points, wins) VALUES (?, ?, MAX(0, ?), MAX(0, ?)) ON CONFLICT (guild, member) DO UPDATE SET points =  MAX(0, points + ?), wins =  MAX(0, wins + ?) RETURNING points, wins", [this.context.guild_id, this.id, points, wins, points, wins], async (err, row) => {
				if (err) {
					reject(err);
				} else {
					resolve((await rewards.checkChanges(this, "points", row.points - points, row.points)).concat(await rewards.checkChanges(this, "wins", row.wins - wins, row.wins)));
				}
			});
		});
	}

	async getAllTimePointRank(): Promise<number> {
		return new Promise((resolve, reject) => {
			this.db.get<{ rank: number }>("SELECT COUNT(*) AS rank FROM global_points WHERE guild = ? AND points > IFNULL((SELECT points FROM global_points WHERE guild = ? AND member = ?), 0)", [this.context.guild_id, this.context.guild_id, this.id], (err, row) => {
				if (err) {
					reject(err);
				} else {
					resolve(row.rank + 1);
				}
			});
		});
	}

	async getAllTimeWinRank(): Promise<number> {
		return new Promise((resolve, reject) => {
			this.db.get<{ rank: number }>("SELECT COUNT(*) AS rank FROM global_points WHERE guild = ? AND wins > IFNULL((SELECT wins FROM global_points WHERE guild = ? AND member = ?), 0)", [this.context.guild_id, this.context.guild_id, this.id], (err, row) => {
				if (err) {
					reject(err);
				} else {
					resolve(row.rank + 1);
				}
			});
		});
	}

	async getAllTimeEntryCount(): Promise<number> {
		return this.simpleCountQuery("SELECT COUNT(*) AS count FROM global_points WHERE guild = ?", [this.context.guild_id]);
	}

	async getAllTimeLeaderboard(wins: boolean, page: number): Promise<{ member: Snowflake, value: number }[]> {
		if (isNaN(page)) page = 1;
		page = Math.max(1, Math.floor(page)) - 1;
		// @formatter:off
		return this.simpleLeaderboardQuery(`SELECT member, ${wins ? "wins" : "points"} AS value FROM global_points WHERE guild = ? ORDER BY value DESC LIMIT 10 OFFSET ?`, [this.context.guild_id, page * 10]);
		// @formatter:on
	}

	async getDailyData(duration: number): Promise<{ points: number, wins: number }> {
		if (isNaN(duration)) duration = 7;
		duration = Math.min(30, Math.max(1, Math.floor(duration)));
		return new Promise((resolve, reject) => {
			this.db.get<{ points: number, wins: number }>("SELECT SUM(points) AS points, SUM(wins) AS wins FROM daily_points WHERE guild = ? AND member = ? AND day >= date('now', ? || ' days')", [this.context.guild_id, this.id, -duration], (err, row) => {
				if (err) {
					reject(err);
				} else {
					!row.points && (row.points = 0);
					!row.wins && (row.wins = 0);
					resolve(row);
				}
			});
		});
	}

	async modifyDailyData(points: number, wins: number) {
		if (isNaN(points) || isNaN(wins)) throw new Error("Invalid number");
		points = Math.round(points);
		wins = Math.round(wins);
		this.db.run("INSERT INTO daily_points (guild, member, day, points, wins) VALUES (?, ?, date(), MAX(0, ?), MAX(0, ?)) ON CONFLICT (guild, member, day) DO UPDATE SET points = MAX(0, points + ?), wins = MAX(0, wins + ?)", [this.context.guild_id, this.id, points, wins, points, wins]);
	}

	async getDailyPointRank(duration: number): Promise<number> {
		if (isNaN(duration)) duration = 7;
		duration = Math.min(30, Math.max(1, Math.floor(duration)));
		return new Promise((resolve, reject) => {
			this.db.get<{ rank: number }>("SELECT COUNT(*) as rank FROM (SELECT SUM(points) as sum FROM daily_points WHERE guild = ? AND day >= date('now', ? || ' days') GROUP BY member) WHERE sum > IFNULL((SELECT SUM(points) FROM daily_points WHERE guild = ? AND member = ? AND day >= date('now', ? || ' days')), 0)", [this.context.guild_id, -duration, this.context.guild_id, this.id, -duration], (err, row) => {
				if (err) {
					reject(err);
				} else {
					resolve(row.rank + 1);
				}
			});
		});
	}

	async getDailyWinRank(duration: number): Promise<number> {
		if (isNaN(duration)) duration = 7;
		duration = Math.min(30, Math.max(1, Math.floor(duration)));
		return new Promise((resolve, reject) => {
			this.db.get<{ rank: number }>("SELECT COUNT(*) as rank FROM (SELECT SUM(wins) as sum FROM daily_points WHERE guild = ? AND day >= date('now', ? || ' days') GROUP BY member) WHERE sum > IFNULL((SELECT SUM(wins) FROM daily_points WHERE guild = ? AND member = ? AND day >= date('now', ? || ' days')), 0)", [this.context.guild_id, -duration, this.context.guild_id, this.id, -duration], (err, row) => {
				if (err) {
					reject(err);
				} else {
					resolve(row.rank + 1);
				}
			});
		});
	}

	async getLegacyData(duration: number): Promise<{ day: string, points: number, wins: number }[]> {
		if (isNaN(duration)) duration = 7;
		duration = Math.min(30, Math.max(1, Math.floor(duration)));
		return new Promise((resolve, reject) => {
			this.db.all<{ day: string, points: number, wins: number }>("SELECT day, points, wins FROM daily_points WHERE guild = ? AND member = ? AND day >= date('now', ? || ' days') ORDER BY day DESC", [this.context.guild_id, this.id, -duration], (err, rows) => {
				if (err) {
					reject(err);
				} else {
					//Add missing days
					let data: { day: string, points: number, wins: number }[] = [];
					let date = new Date();
					date.setHours(0, 0, 0, 0);
					date.setDate(date.getDate() + 1);
					for (let i = 0; i <= duration; i++) {
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

	async getDailyEntryCount(duration: number): Promise<number> {
		if (isNaN(duration)) duration = 7;
		duration = Math.min(30, Math.max(1, Math.floor(duration)));
		return this.simpleCountQuery("SELECT COUNT(*) AS count FROM daily_points WHERE guild = ? AND day >= date('now', ? || ' days')", [this.context.guild_id, -duration]);
	}

	async getDailyLeaderboard(wins: boolean, duration: number, page: number): Promise<{ member: Snowflake, value: number }[]> {
		if (isNaN(page)) page = 1;
		page = Math.max(1, Math.floor(page)) - 1;
		if (isNaN(duration)) duration = 7;
		duration = Math.min(30, Math.max(1, Math.floor(duration)));
		// @formatter:off
		return this.simpleLeaderboardQuery(`SELECT member, SUM(${wins ? "wins" : "points"}) AS value FROM daily_points WHERE guild = ? AND day >= date('now', ? || ' days') GROUP BY member ORDER BY value DESC LIMIT 10 OFFSET ?`, [this.context.guild_id, -duration, page * 10]);
		// @formatter:on
	}

	private simpleCountQuery(sql: string, params: (string | number)[]): Promise<number> {
		return new Promise((resolve, reject) => {
			this.db.get<{ count: number }>(sql, params, (err, row) => {
				if (err) {
					reject(err);
				} else {
					resolve(row ? row.count : 0);
				}
			});
		});
	}

	private simpleLeaderboardQuery(sql: string, params: (string | number)[]): Promise<{ member: Snowflake, value: number }[]> {
		return new Promise((resolve, reject) => {
			this.db.all<{ member: Snowflake, value: number }>(sql, params, (err, rows) => {
				if (err) {
					reject(err);
				} else {
					resolve(rows);
				}
			});
		});
	}
}

export function getUser(member: GuildMember, base: ChatInputCommandInteraction | Message): BotUserContext | null {
	const context = getServerContext(member.guild.id);
	if (!context) {
		return null;
	}
	return new BotUserContext(member.id, context, base);
}

export function getRawUser(guild: Snowflake, user: Snowflake): BotUserContext | null {
	const context = getServerContext(guild);
	if (!context) {
		return null;
	}
	return new BotUserContext(user, context, null);
}