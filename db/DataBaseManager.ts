import Database, {Statement} from "better-sqlite3";
import {Snowflake} from "discord.js";

const db = new Database("./ranking.db");
db.pragma("journal_mode = WAL");

db.prepare("CREATE TABLE IF NOT EXISTS global_points (guild TEXT, member TEXT, points INTEGER, wins INTEGER, PRIMARY KEY (guild, member))").run();
db.prepare("CREATE TABLE IF NOT EXISTS daily_points (guild TEXT, member TEXT, day INTEGER, points INTEGER, wins INTEGER, PRIMARY KEY (guild, member, day))").run();

//@formatter:off
const total = {
	get: prepareGet<{guild: Snowflake, member: Snowflake}>("SELECT points, wins FROM global_points WHERE guild = @guild AND member = @member"),
	entrySum: prepareGet<{guild: Snowflake}>("SELECT SUM(points) AS points, SUM(wins) AS wins FROM global_points WHERE guild = @guild"),
	entryCount: prepareCount<{guild: Snowflake}>("SELECT COUNT(*) AS count FROM global_points WHERE guild = @guild"),

	rank: prepareGet<{guild: Snowflake, member: Snowflake}>(`
        SELECT SUM(other.points > IFNULL(self.points, 0)) AS points, SUM(other.wins > IFNULL(self.points, 0)) as wins
        FROM global_points other LEFT JOIN global_points self ON self.guild = @guild AND self.member = @member WHERE other.guild = @guild`),
	leaderboard: {
		points: prepareLeaderboard<{guild: Snowflake, page: number}>("SELECT member, points AS value FROM global_points WHERE guild = @guild ORDER BY value DESC LIMIT 10 OFFSET (@page - 1) * 10"),
		wins: prepareLeaderboard<{guild: Snowflake, page: number}>("SELECT member, wins AS value FROM global_points WHERE guild = @guild ORDER BY value DESC LIMIT 10 OFFSET (@page - 1) * 10")
	},

	modify: prepareGet<{guild: Snowflake, member: Snowflake, points: number, wins: number}>(`
        INSERT INTO global_points (guild, member, points, wins) VALUES (@guild, @member, MAX(0, @points), MAX(0, @wins))
        ON CONFLICT (guild, member) DO UPDATE SET points = MAX(0, points + @points), wins = MAX(0, wins + @wins) RETURNING points, wins`)
};

const daily = {
	get: prepareGet<{guild: Snowflake, member: Snowflake, duration: number}>("SELECT SUM(points) AS points, SUM(wins) AS wins FROM daily_points WHERE guild = @guild AND member = @member AND day >= date('now', '-' || @duration || ' days')"),
	history: prepareHistory<{guild: Snowflake, member: Snowflake, duration: number}>("SELECT day, points, wins FROM daily_points WHERE guild = @guild AND member = @member AND day >= date('now', '-' || @duration || ' days') ORDER BY day DESC"),
	entryCount: prepareCount<{guild: Snowflake, duration: number}>("SELECT COUNT(*) AS count FROM daily_points WHERE guild = @guild AND day >= date('now', '-' || @duration || ' days')"),

	rank: prepareGet<{guild: Snowflake, member: Snowflake, duration: number}>(`
			WITH totals AS (SELECT member, SUM(points) AS points, SUM(wins) AS wins FROM daily_points WHERE guild = @guild AND day >= date('now', '-' || @duration || ' days') GROUP BY member)
            SELECT SUM(other.points > IFNULL(self.points, 0)) as points, SUM(other.wins > IFNULL(self.points, 0)) as wins
            FROM totals other LEFT JOIN totals self ON self.member = @member`),
	leaderboard: {
		points: prepareLeaderboard<{guild: Snowflake, page: number, duration: number}>("SELECT member, SUM(points) AS value FROM daily_points WHERE guild = @guild AND day >= date('now', '-' || @duration || ' days') GROUP BY member ORDER BY value DESC LIMIT 10 OFFSET (@page - 1) * 10"),
		wins: prepareLeaderboard<{guild: Snowflake, page: number, duration: number}>("SELECT member, SUM(wins) AS value FROM daily_points WHERE guild = @guild AND day >= date('now', '-' || @duration || ' days') GROUP BY member ORDER BY value DESC LIMIT 10 OFFSET (@page - 1) * 10")
	},

	modify: prepareGet<{guild: Snowflake, member: Snowflake, points: number, wins: number}>(`
        INSERT INTO daily_points (guild, member, day, points, wins) VALUES (@guild, @member, date(), MAX(0, @points), MAX(0, @wins))
        ON CONFLICT (guild, member, day) DO UPDATE SET points = MAX(0, points + @points), wins = MAX(0, wins + @wins) RETURNING points, wins`)
};

const control = {
	deleteUser(args: {member: Snowflake}) {
		db.prepare("DELETE FROM global_points WHERE member = @member").run(args);
		db.prepare("DELETE FROM daily_points WHERE member = @member").run(args);
	},
	deleteGuild(args: {guild: Snowflake}) {
		db.prepare("DELETE FROM global_points WHERE guild = @guild").run(args);
		db.prepare("DELETE FROM daily_points WHERE guild = @guild").run(args);
	}
};
//@formatter:on

function prepareGet<T extends {}>(sql: string) {
	const statement: Statement<[T], {points: number, wins: number}> = db.prepare(sql);
	return (args: T) => statement.get(args) || {points: 0, wins: 0};
}

function prepareCount<T extends {}>(sql: string) {
	const statement: Statement<[T], {count: number}> = db.prepare(sql);
	return (args: T) => statement.get(args)?.count || 0;
}

function prepareLeaderboard<T extends {}>(sql: string) {
	const statement: Statement<[T], {member: Snowflake, value: number}> = db.prepare(sql);
	return (args: T) => statement.all(args);
}

function prepareHistory<T extends {}>(sql: string) {
	const statement: Statement<[T], {day: string, points: number, wins: number}> = db.prepare(sql);
	return (args: T) => statement.all(args);
}

const statements = {total, daily, control};

export {statements as db};