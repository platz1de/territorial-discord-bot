import {GuildMember, Snowflake} from "discord.js";
import {Database} from "sqlite3";
import {DataBaseResponse} from "./DataBaseManager";
import {rewards} from "../PointManager";

class GlobalDataBaseProvider {
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
            this.db.get<{ points: number, wins: number }>("SELECT points, wins FROM global_points WHERE member = ?", [member.id], (err, row) => {
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
            this.db.get<{ points: number, wins: number }>("SELECT SUM(points) AS points, SUM(wins) AS wins FROM global_points", [], (err, row) => {
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

    async addData(member: GuildMember, points: number, wins: number): Promise<DataBaseResponse> {
        if (isNaN(points) || isNaN(wins)) return {success: false, error: "Invalid number"};
        points = Math.max(0, Math.round(points));
        wins = Math.max(0, Math.round(wins));
        return new Promise((resolve, reject) => {
            this.db.get<{ points: number, wins: number }>("INSERT INTO global_points (member, points, wins) VALUES (?, ?, ?) ON CONFLICT (member) DO UPDATE SET points = points + ?, wins = wins + ? RETURNING points, wins", [member.id, points, wins, points, wins], (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    resolve({success: true, reward: rewards.checkChanges(member, "points", "total", row.points - points, row.points).concat(rewards.checkChanges(member, "wins", "total", row.wins - wins, row.wins))});
                }
            });
        });
    }

    async removePoints(member: GuildMember, points: number) {
        return this.removeData(member, points, 0);
    }

    async removeWins(member: GuildMember, wins: number) {
        return this.removeData(member, 0, wins);
    }

    async removeData(member: GuildMember, points: number, wins: number): Promise<DataBaseResponse> {
        if (isNaN(points) || isNaN(wins)) return {success: false, error: "Invalid number"};
        let data = await this.getData(member);
        points = Math.max(0, Math.min(Math.round(points), data.points));
        wins = Math.max(0, Math.min(Math.round(wins), data.wins));
        return new Promise((resolve, reject) => {
            this.db.get<{ points: number, wins: number }>("INSERT INTO global_points (member, points, wins) VALUES (?, 0, 0) ON CONFLICT (member) DO UPDATE SET points = MAX(0, points - ?), wins = MAX(0, wins - ?) RETURNING points, wins", [member.id, points, wins], (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    resolve({success: true, reward: rewards.checkChanges(member, "points", "total", row.points + points, row.points).concat(rewards.checkChanges(member, "wins", "total", row.wins + wins, row.wins))});
                }
            });
        });
    }

    async getPointRank(member: GuildMember): Promise<number> {
        return new Promise((resolve, reject) => {
            this.db.get<{ rank: number }>("SELECT COUNT(*) AS rank FROM global_points WHERE points > IFNULL((SELECT points FROM global_points WHERE member = ?), 0)", [member.id], (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(row.rank + 1);
                }
            });
        });
    }

    async getWinRank(member: GuildMember): Promise<number> {
        return new Promise((resolve, reject) => {
            this.db.get<{ rank: number }>("SELECT COUNT(*) AS rank FROM global_points WHERE wins > IFNULL((SELECT wins FROM global_points WHERE member = ?), 0)", [member.id], (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(row.rank + 1);
                }
            });
        });
    }

    async getEntryCount(): Promise<number> {
        return new Promise((resolve, reject) => {
            this.db.get<{ count: number }>("SELECT COUNT(*) AS count FROM global_points", [], (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(row ? row.count : 0);
                }
            });
        });
    }

    async getPointLeaderboard(page: number): Promise<{ member: Snowflake, points: number }[]> {
        if (isNaN(page)) page = 1;
        page = Math.max(1, Math.floor(page)) - 1;
        return new Promise((resolve, reject) => {
            this.db.all<{ member: Snowflake, points: number }>("SELECT member, points FROM global_points ORDER BY points DESC LIMIT 10 OFFSET ?", [page * 10], (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });
    }

    async getWinLeaderboard(page: number): Promise<{ member: Snowflake, wins: number }[]> {
        if (isNaN(page)) page = 1;
        page = Math.max(1, page) - 1;
        return new Promise((resolve, reject) => {
            this.db.all<{ member: Snowflake, wins: number }>("SELECT member, wins FROM global_points ORDER BY wins DESC LIMIT 10 OFFSET ?", [page * 10], (err, rows) => {
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