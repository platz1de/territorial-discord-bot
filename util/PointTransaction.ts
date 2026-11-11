import {Guild, Snowflake, userMention} from "discord.js";
import {normalizeChanges, RewardAnswer} from "./RewardManager.js";
import {format, toRewardString} from "./EmbedUtil.js";
import {MultiplierSetting} from "../BotSettingProvider.js";
import {db} from "../db/DataBaseManager.js";
import {rewards} from "../PointManager.js";

export async function createPointTransaction(member: Snowflake, guild: Guild, multiplier: MultiplierSetting | null, points: number, wins: number) {
	const transaction = new PointTransaction(member, guild, multiplier);
	await transaction.edit(points, wins);
	return transaction;
}

// TODO: this should also fixate the day that daily data is added to
export class PointTransaction {
	private readonly member: Snowflake;
	private readonly guild: Guild;
	private points: number = 0;
	private wins: number = 0;
	private rewards: RewardAnswer[] = [];
	private readonly multiplier: MultiplierSetting | null;

	constructor(member: Snowflake, guild: Guild, multiplier: MultiplierSetting | null) {
		this.member = member;
		this.multiplier = multiplier;
		this.guild = guild;
	}

	/**
	 * Change the points of this transaction.
	 * @param newPoints new point amount, may be a float.
	 */
	async editPoints(newPoints: number) {
		await this.edit(newPoints, this.wins);
	}

	/**
	 * Change the points and wins of this transaction.
	 * @param newPoints new point amount, may be a float.
	 * @param newWins new win amount.
	 */
	async edit(newPoints: number, newWins: number) {
		if (isNaN(newPoints) || isNaN(newWins)) throw new Error("Invalid arguments");
		if (newPoints === this.points && newWins === this.wins) return;

		const pointDiff = Math.ceil(newPoints * (this.multiplier ? this.multiplier.amount : 1)) - Math.ceil(this.points * (this.multiplier ? this.multiplier.amount : 1));
		newWins = Math.round(newWins);

		db.daily.modify({guild: this.guild.id, member: this.member, points: pointDiff, wins: newWins - this.wins});
		const row = db.total.modify({guild: this.guild.id, member: this.member, points: pointDiff, wins: newWins - this.wins});

		const rewardChanges = await this.guild.members.fetch(this.member).then(async member =>
			(await rewards.checkChanges(member, "points", row.points - pointDiff, row.points))
				.concat(await rewards.checkChanges(member, "wins", row.wins - newWins - this.wins, row.wins)))
			.catch(() => []);

		this.rewards = normalizeChanges(this.rewards, rewardChanges);
		this.points = newPoints;
		this.wins = newWins;
	}

	longMemberString(personal: boolean) {
		return `${personal ? "your" : userMention(this.member) + "'s"} balance${toRewardString(this.rewards, personal, false)}`;
	}

	shortMemberString() {
		return userMention(this.member) + toRewardString(this.rewards, false, true);
	}

	buildDescription(personal: boolean, memberString: string | null = null) {
		if (this.points === 0 && this.wins === 0) return "";

		memberString ??= this.longMemberString(personal);
		if (Math.abs(this.wins) === 1) {
			return `${this.wins === 1 ? "Registered" : "Removed"} win of ${format(Math.ceil(this.points * this.wins))} ${this.multiplier ? `\`x ${this.multiplier.amount} (multiplier)\` ` : ``}points ${this.wins === 1 ? "to" : "from"} ${memberString}`
		}

		return `Modified ${this.points !== 0 ? "points" : "wins"} of ${userMention(this.member)} by ${format(this.points !== 0 ? this.points : this.wins)}${this.wins !== 0 ? ` and wins by ${this.wins}` : ""}` + toRewardString(this.rewards, personal, false);
	}

	// TODO: changelog: claim message in claim channel uses personal reward strings
}