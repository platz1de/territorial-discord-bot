import {Guild, Snowflake} from "discord.js";
import {createPointTransaction, PointTransaction} from "./PointTransaction.js";
import {MultiplierSetting} from "../BotSettingProvider.js";

type TransactionPart = {transaction: PointTransaction, factor: number};

export class BulkPointTransaction {
	private readonly guild: Guild;
	private readonly multiplier: MultiplierSetting | null;
	private points: number;
	private readonly wins: number;
	private readonly parts: Map<Snowflake, TransactionPart> = new Map();

	constructor(guild: Guild, multiplier: MultiplierSetting | null, points: number, wins: number) {
		this.guild = guild;
		this.multiplier = multiplier;
		this.points = points;
		this.wins = wins;
	}

	async editPoints(newPoints: number) {
		if (newPoints === this.points) return;

		for (const part of this.parts.values()) {
			await part.transaction.editPoints(newPoints * part.factor);
		}

		this.points = newPoints;
	}

	async apply(userId: Snowflake, factor: number = 1) {
		const part = this.parts.get(userId);
		if (part) {
			await part.transaction.editPoints(this.points * factor);
			part.factor = factor;
			return;
		}

		this.parts.set(userId, {transaction: await createPointTransaction(userId, this.guild, this.multiplier, this.points * factor, this.wins), factor});
	}

	getAppliedFactor(user: Snowflake) : number | undefined {
		return this.parts.get(user)?.factor;
	}

	getPart(user: Snowflake): PointTransaction | undefined {
		return this.parts.get(user)?.transaction;
	}

	// TODO: Move these...
	claimedUserList(original: string) {
		if (this.parts.size === 0) return original;
		return `${original}\n\n**Claimed by:**"\n${Array.from(this.parts, ([user, part]) => part.factor === 1 ? `<@${user}>` : `<@${user}> \`x ${part.factor}\``).join("\n")}`;
	}

	affectedUserList(user: Snowflake) {
		if (this.parts.size === 1) {
			return this.parts.values().next().value!.transaction.longMemberString(this.parts.has(user));
		}
		return `\n${Array.from(this.parts.values(), part => part.transaction.shortMemberString()).join("\n")}`;
	}
}