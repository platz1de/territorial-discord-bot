import {BotUserContext} from "./BotUserContext.js";
import {userMention} from "discord.js";
import {normalizeChanges, RewardAnswer} from "./RewardManager.js";
import {format, toRewardString} from "./EmbedUtil.js";
import {MultiplierSetting} from "../BotSettingProvider.js";

export async function createPointTransaction(user: BotUserContext, multiplier: MultiplierSetting | null, points: number, wins: number) {
	const transaction = new PointTransaction(user, multiplier);
	await transaction.edit(points, wins);
	return transaction;
}

// TODO: this should also fixate the day that daily data is added to
export class PointTransaction {
	private readonly user: BotUserContext;
	private points: number = 0;
	private wins: number = 0;
	private rewards: RewardAnswer[] = [];
	private readonly multiplier: MultiplierSetting | null;

	constructor(user: BotUserContext, multiplier: MultiplierSetting | null) {
		this.user = user;
		this.multiplier = multiplier;
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
		if (newPoints === this.points && newWins === this.wins) return;

		const pointDiff = Math.ceil(newPoints * (this.multiplier ? this.multiplier.amount : 1)) - Math.ceil(this.points * (this.multiplier ? this.multiplier.amount : 1));
		this.rewards = normalizeChanges(this.rewards, await this.user.modifyData(pointDiff, newWins - this.wins));
		this.points = newPoints;
		this.wins = newWins;
	}

	longMemberString(personal: boolean) {
		return `${personal ? "your" : userMention(this.user.id) + "'s"} balance${toRewardString(this.rewards, personal, false)}`;
	}

	shortMemberString() {
		return userMention(this.user.id) + toRewardString(this.rewards, false, true);
	}

	buildDescription(personal: boolean, memberString: string | null = null) {
		if (this.points === 0 && this.wins === 0) return "";

		memberString ??= this.longMemberString(personal);
		if (Math.abs(this.wins) === 1) {
			return `${this.wins === 1 ? "Registered" : "Removed"} win of ${format(Math.ceil(this.points * this.wins))} ${this.multiplier ? `\`x ${this.multiplier.amount} (multiplier)\` ` : ``}points ${this.wins === 1 ? "to" : "from"} ${memberString}`
		}

		return `Modified ${this.points !== 0 ? "points" : "wins"} of ${userMention(this.user.id)} by ${format(this.points !== 0 ? this.points : this.wins)}${this.wins !== 0 ? ` and wins by ${this.wins}` : ""}` + toRewardString(this.rewards, personal, false);
	}

	// TODO: changelog: claim message in claim channel uses personal reward strings
}