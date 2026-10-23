import {Snowflake} from "discord.js";
import {createPointTransaction, PointTransaction} from "./PointTransaction.js";
import {BotUserContext, getRawUser} from "./BotUserContext.js";
import {MultiplierSetting} from "../BotSettingProvider.js";

type TransactionPart = {transaction: PointTransaction, factor: number};

export class BulkPointTransaction {
	private readonly guildId: Snowflake;
	private readonly multiplier: MultiplierSetting | null;
	private points: number;
	private readonly wins: number;
	private readonly parts: Map<Snowflake, TransactionPart> = new Map();

	constructor(guildId: Snowflake, multiplier: MultiplierSetting | null, points: number, wins: number) {
		this.guildId = guildId;
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

		this.parts.set(userId, {transaction: await createPointTransaction(getRawUser(this.guildId, userId)!, this.multiplier, this.points * factor, this.wins), factor});
	}

	getAppliedFactor(user: BotUserContext) : number | undefined {
		return this.parts.get(user.id)?.factor;
	}

	getPart(context: BotUserContext): PointTransaction | undefined {
		return this.parts.get(context.id)?.transaction;
	}

	// TODO: Move these...
	claimedUserList(original: string) {
		if (this.parts.size === 0) return original;
		return `${original}\n\n**Claimed by:**"\n${Array.from(this.parts, ([user, part]) => part.factor === 1 ? `<@${user}>` : `<@${user}> \`x ${part.factor}\``).join("\n")}`;
	}

	affectedUserList(context: BotUserContext) {
		if (this.parts.size === 1) {
			return this.parts.values().next().value!.transaction.longMemberString(this.parts.has(context.user.id));
		}
		return `\n${Array.from(this.parts.values(), part => part.transaction.shortMemberString()).join("\n")}`;
	}
}