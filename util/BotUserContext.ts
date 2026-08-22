import {Guild, GuildMember, Message, Snowflake} from "discord.js";
import {client, rewards} from "../PointManager.js";
import {getServerContext, ServerSetting, updateSettings} from "../BotSettingProvider.js";
import {RewardAnswer} from "./RewardManager.js";
import {BaseUserContext, InteractionTypes} from "./BaseUserContext.js";
export type  {MultiplierSetting} from "../BotSettingProvider.js";

export class BotUserContext extends BaseUserContext {
	context: ServerSetting;

	constructor(id: Snowflake, context: ServerSetting, base: Message | InteractionTypes | null) {
		super(id, base, (base && base.guild) ? null : client.guilds.cache.get(context.guild_id) as Guild);
		this.context = context;
	}

	hasModAccess(): boolean {
		if (!this.member) return false;
		return this.member.roles.cache.hasAny( ... this.context.mod_roles );
	}
	//Check if user can claim a Win or add/remove points; Mods implicitly have access
	canClaimWin(): boolean {
		if (!this.member) return false;
		return this.member.roles.cache.hasAny( ... this.context.claim_win_roles ) || this.hasModAccess();
	}

	async registerWin(points: number): Promise<RewardAnswer[]> {
		this.modifyDailyData(points, 1);
		return this.modifyAllTimeData(points, 1);
	}

	async removeWin(points: number): Promise<RewardAnswer[]> {
		this.modifyDailyData(-points, -1);
		return this.modifyAllTimeData(-points, -1);
	}

	async modifyPoints(points: number): Promise<RewardAnswer[]> {
		this.modifyDailyData(points, 0);
		return this.modifyAllTimeData(points, 0);
	}

	async modifyWins(wins: number): Promise<RewardAnswer[]> {
		this.modifyDailyData(0, wins);
		return this.modifyAllTimeData(0, wins);
	}

	getData(): { points: number, wins: number } {
		return this.db.prepare<[Snowflake, Snowflake], { points: number, wins: number }>("SELECT points, wins FROM global_points WHERE guild = ? AND member = ?").get(this.context.guild_id, this.id) || {points: 0, wins: 0};
	}

	getTotalData(): { points: number, wins: number } {
		return this.db.prepare<[Snowflake], { points: number, wins: number }>("SELECT SUM(points) AS points, SUM(wins) AS wins FROM global_points WHERE guild = ?").get(this.context.guild_id) || {points: 0, wins: 0};
	}

	async modifyAllTimeData(points: number, wins: number): Promise<RewardAnswer[]> {
		if (isNaN(points) || isNaN(wins)) throw new Error("Invalid number");
		points = Math.round(points);
		wins = Math.round(wins);
		const row = this.db.prepare<[Snowflake, Snowflake, number, number, number, number], { points: number, wins: number }>("INSERT INTO global_points (guild, member, points, wins) VALUES (?, ?, MAX(0, ?), MAX(0, ?)) ON CONFLICT (guild, member) DO UPDATE SET points =  MAX(0, points + ?), wins =  MAX(0, wins + ?) RETURNING points, wins").get(this.context.guild_id, this.id, points, wins, points, wins);
		if (!row) {
			return [];
		}
		return (await rewards.checkChanges(this, "points", row.points - points, row.points)).concat(await rewards.checkChanges(this, "wins", row.wins - wins, row.wins));
	}

	getAllTimePointRank(): number {
		const row = this.db.prepare<[Snowflake, Snowflake, Snowflake], { rank: number }>("SELECT COUNT(*) AS rank FROM global_points WHERE guild = ? AND points > IFNULL((SELECT points FROM global_points WHERE guild = ? AND member = ?), 0)").get(this.context.guild_id, this.context.guild_id, this.id)
		return row ? row.rank + 1 : 1;
	}

	getAllTimeWinRank(): number {
		const row = this.db.prepare<[Snowflake, Snowflake, Snowflake], { rank: number }>("SELECT COUNT(*) AS rank FROM global_points WHERE guild = ? AND wins > IFNULL((SELECT wins FROM global_points WHERE guild = ? AND member = ?), 0)").get(this.context.guild_id, this.context.guild_id, this.id)
		return row ? row.rank + 1 : 1;
	}

	getAllTimeEntryCount(): number {
		return this.simpleCountQuery("SELECT COUNT(*) AS count FROM global_points WHERE guild = ?", [this.context.guild_id]);
	}

	getAllTimeLeaderboard(wins: boolean, page: number): { member: Snowflake, value: number }[] {
		if (isNaN(page)) page = 1;
		page = Math.max(1, Math.floor(page)) - 1;
		// @formatter:off
		return this.simpleLeaderboardQuery(`SELECT member, ${wins ? "wins" : "points"} AS value FROM global_points WHERE guild = ? ORDER BY value DESC LIMIT 10 OFFSET ?`, [this.context.guild_id, page * 10]);
		// @formatter:on
	}

	getDailyData(duration: number): { points: number, wins: number } {
		if (isNaN(duration)) duration = 7;
		duration = Math.min(30, Math.max(1, Math.floor(duration)));
		return this.db.prepare<[Snowflake, Snowflake, number], { points: number, wins: number }>("SELECT SUM(points) AS points, SUM(wins) AS wins FROM daily_points WHERE guild = ? AND member = ? AND day >= date('now', ? || ' days')").get(this.context.guild_id, this.id, -duration) || {points: 0, wins: 0};
	}

	modifyDailyData(points: number, wins: number) {
		if (isNaN(points) || isNaN(wins)) throw new Error("Invalid number");
		points = Math.round(points);
		wins = Math.round(wins);
		this.db.prepare("INSERT INTO daily_points (guild, member, day, points, wins) VALUES (?, ?, date(), MAX(0, ?), MAX(0, ?)) ON CONFLICT (guild, member, day) DO UPDATE SET points = MAX(0, points + ?), wins = MAX(0, wins + ?)").run(this.context.guild_id, this.id, points, wins, points, wins);
	}

	getDailyPointRank(duration: number): number {
		if (isNaN(duration)) duration = 7;
		duration = Math.min(30, Math.max(1, Math.floor(duration)));
		const row = this.db.prepare<[Snowflake, number, Snowflake, Snowflake, number], { rank: number }>("SELECT COUNT(*) as rank FROM (SELECT SUM(points) as sum FROM daily_points WHERE guild = ? AND day >= date('now', ? || ' days') GROUP BY member) WHERE sum > IFNULL((SELECT SUM(points) FROM daily_points WHERE guild = ? AND member = ? AND day >= date('now', ? || ' days')), 0)").get(this.context.guild_id, -duration, this.context.guild_id, this.id, -duration);
		return row ? row.rank + 1 : 1;
	}

	getDailyWinRank(duration: number): number {
		if (isNaN(duration)) duration = 7;
		duration = Math.min(30, Math.max(1, Math.floor(duration)));
		const row = this.db.prepare<[Snowflake, number, Snowflake, Snowflake, number], { rank: number }>("SELECT COUNT(*) as rank FROM (SELECT SUM(wins) as sum FROM daily_points WHERE guild = ? AND day >= date('now', ? || ' days') GROUP BY member) WHERE sum > IFNULL((SELECT SUM(wins) FROM daily_points WHERE guild = ? AND member = ? AND day >= date('now', ? || ' days')), 0)").get(this.context.guild_id, -duration, this.context.guild_id, this.id, -duration);
		return row ? row.rank + 1 : 1;
	}

	getLegacyData(duration: number): { day: string, points: number, wins: number }[] {
		if (isNaN(duration)) duration = 7;
		duration = Math.min(30, Math.max(1, Math.floor(duration)));
		const rows = this.db.prepare<[Snowflake, Snowflake, number], { day: string, points: number, wins: number }>("SELECT day, points, wins FROM daily_points WHERE guild = ? AND member = ? AND day >= date('now', ? || ' days') ORDER BY day DESC").all(this.context.guild_id, this.id, -duration);
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
		return data.reverse();
	}

	saveContext() {
		updateSettings();
	}

	getDailyEntryCount(duration: number): number {
		if (isNaN(duration)) duration = 7;
		duration = Math.min(30, Math.max(0, Math.floor(duration)));
		return this.simpleCountQuery("SELECT COUNT(*) AS count FROM daily_points WHERE guild = ? AND day >= date('now', ? || ' days')", [this.context.guild_id, -duration]);
	}

	getDailyLeaderboard(wins: boolean, duration: number, page: number): { member: Snowflake, value: number }[] {
		if (isNaN(page)) page = 1;
		page = Math.max(1, Math.floor(page)) - 1;
		if (isNaN(duration)) duration = 7;
		duration = Math.min(30, Math.max(0, Math.floor(duration)));
		// @formatter:off
		return this.simpleLeaderboardQuery(`SELECT member, SUM(${wins ? "wins" : "points"}) AS value FROM daily_points WHERE guild = ? AND day >= date('now', ? || ' days') GROUP BY member ORDER BY value DESC LIMIT 10 OFFSET ?`, [this.context.guild_id, -duration, page * 10]);
		// @formatter:on
	}

	private simpleCountQuery(sql: string, params: (string | number)[]): number {
		const row = this.db.prepare<typeof params, { count: number }>(sql).get(...params);
		return row ? row.count : 0;
	}

	private simpleLeaderboardQuery(sql: string, params: (string | number)[]): { member: Snowflake, value: number }[] {
		return this.db.prepare<typeof params, { member: Snowflake, value: number }>(sql).all(...params) || [];
	}
}

export function getUser(member: GuildMember, base: InteractionTypes | Message): BotUserContext | BaseUserContext {
	const context = getServerContext(member.guild.id);
	if (!context) {
		return new BaseUserContext(member.id, base, member.guild);
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