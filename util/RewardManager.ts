import {Colors, Guild, GuildMember, Snowflake} from "discord.js";
import {createServerContext, LimitedServerSettings, ServerContext} from "./ServerContext.js";
import {db} from "../db/DataBaseManager.js";

let rewards: { [key: string]: Reward[] } = {};
let hierarchy: { [key: string]: number[] } = {};

export interface RewardAnswer {
	type: string,
	role_type: string,
	role_amount: number,
	role_id: string
}

export function getRewardList(guild: Guild): Reward[] {
	let list: Reward[] = [];
	for (const reward of hierarchy[guild.id]) {
		list.push(rewards[guild.id][reward]);
	}
	return list;
}

export async function calculateEligibleRoles(member: Snowflake, guild: Guild) {
	const total = db.total.get({guild: guild.id, member});
	const roles: Reward[] = [];
	for (const reward of rewards[guild.id]) {
		if (total[reward.type] >= reward.count) {
			roles.push(reward);
		}
	}
	return roles;
}

export function filterByHierarchy(roles: Reward[]): Reward[] {
	let highestPoints: { amount: number, obj: Reward | null } = {amount: -1, obj: null};
	let highestWins: { amount: number, obj: Reward | null } = {amount: -1, obj: null};
	for (const role of roles) {
		if (role.type === "points" && role.count > highestPoints.amount) {
			highestPoints.amount = role.count;
			highestPoints.obj = role;
		} else if (role.type === "wins" && role.count > highestWins.amount) {
			highestWins.amount = role.count;
			highestWins.obj = role;
		}
	}
	let filtered: Reward[] = [];
	highestPoints.obj !== null && filtered.push(highestPoints.obj);
	highestWins.obj !== null && filtered.push(highestWins.obj);
	return filtered;
}

export async function getProgress(member: Snowflake, guild: Guild): Promise<{ role: Snowflake, has: number, needs: number }[]> {
	const total = db.total.get({guild: guild.id, member});
	const progress: { role: Snowflake, has: number, needs: number }[] = [];
	for (const id of hierarchy[guild.id]) {
		const reward = rewards[guild.id][id];
		if (total[reward.type] < reward.count) {
			if (progress[(reward.type === "points" ? 0 : 1)]) continue;
			progress[(reward.type === "points" ? 0 : 1)] = {role: reward.role_id, has: total[reward.type], needs: reward.count};
		}
	}
	return progress;
}

export function loadRewards(setting: LimitedServerSettings) {
	let winCache: number[] = [];
	let pointCache: number[] = [];
	rewards[setting.guild_id] = [];
	for (const data of setting.rewards) {
		rewards[setting.guild_id].push(new Reward(data.role_id, data.type, data.count));
		if (data.type === "wins") {
			winCache.push(rewards[setting.guild_id].length - 1);
		} else {
			pointCache.push(rewards[setting.guild_id].length - 1);
		}
	}
	winCache.sort((a, b) => rewards[setting.guild_id][a].count - rewards[setting.guild_id][b].count);
	pointCache.sort((a, b) => rewards[setting.guild_id][a].count - rewards[setting.guild_id][b].count);
	hierarchy[setting.guild_id] = winCache.concat(pointCache);
}

export async function checkChanges(member: GuildMember, type: string, from: number, to: number): Promise<RewardAnswer[]> {
	const context = createServerContext(member.guild);
	if (!context) return [];

	let changes: RewardAnswer[] = [];
	for (const reward of rewards[member.guild.id]) {
		changes = reward.checkChange(context, member, type, from, to, changes);
	}

	if (context.getSettings().roles === "highest") {
		setTimeout(() => applyHierarchy(member, changes), 2000);
	}

	return changes;
}

function applyHierarchy(member: GuildMember, changes: RewardAnswer[]) {
	if (changes.length === 0) return;
	let lowestPoints = Infinity;
	let lowestWins = Infinity;
	for (const reward of changes) {
		const index = hierarchy[member.guild.id].findIndex(r => r === rewards[member.guild.id].findIndex(r => r.role_id === reward.role_id));
		if (index === -1) {
			throw new Error("Reward not found in hierarchy");
		}
		if (reward.role_type === "points" && index < lowestPoints) {
			lowestPoints = index;
		} else if (reward.role_type === "wins" && index < lowestWins) {
			lowestWins = index;
		}
	}
	const replacePoints = hierarchy[member.guild.id][lowestPoints - 1];
	const replaceWins = hierarchy[member.guild.id][lowestWins - 1];
	if (changes[0].type === "Added") {
		if (replacePoints !== undefined && rewards[member.guild.id][replacePoints].type === "points") {
			member.roles.remove(rewards[member.guild.id][replacePoints].role_id, "Meets higher criteria").catch(console.error);
		}
		if (replaceWins !== undefined && rewards[member.guild.id][replaceWins].type === "wins") {
			member.roles.remove(rewards[member.guild.id][replaceWins].role_id, "Meets higher criteria").catch(console.error);
		}
	} else {
		if (replacePoints !== undefined && rewards[member.guild.id][replacePoints].type === "points") {
			member.roles.add(rewards[member.guild.id][replacePoints].role_id, "No longer meets higher criteria").catch(console.error);
		}
		if (replaceWins !== undefined && rewards[member.guild.id][replaceWins].type === "wins") {
			member.roles.add(rewards[member.guild.id][replaceWins].role_id, "No longer meets higher criteria").catch(console.error);
		}
	}
}

export function normalizeChanges(changes: RewardAnswer[], add: RewardAnswer[]): RewardAnswer[] {
	for (const change of add) {
		const index = changes.findIndex(c => c.role_id === change.role_id);
		if (index === -1) {
			changes.push(change);
		} else {
			changes.splice(index, 1);
		}
	}
	return changes;
}

export class Reward {
	role_id: string;
	type: "wins" | "points";
	count: number;

	constructor(role_id: string, type: "points" | "wins", count: number) {
		this.role_id = role_id;
		this.type = type;
		this.count = count;
	}

	checkChange(context: ServerContext, member: GuildMember, type: string, from: number, to: number, changes: RewardAnswer[]) {
		if (this.type !== type) return changes;
		if (from < this.count && to >= this.count) {
			member.roles.add(this.role_id, `Reward for reaching ${this.count} ${this.type}`).then(() => {
				context.logAction(member.user, `Added role <@&${this.role_id}> for reaching ${this.count} ${this.type}`, Colors.Blurple);
			}).catch(console.error);
			changes.push({type: "Added", role_type: this.type, role_amount: this.count, role_id: this.role_id});
		} else if (from >= this.count && to < this.count) {
			member.roles.remove(this.role_id, `Reward for reaching ${this.count} ${this.type} was removed do to no longer meeting the requirement`).then(() => {
				context.logAction(member.user, `Removed role <@&${this.role_id}> for no longer meeting criteria`, Colors.Blurple);
			}).catch(console.error);
			changes.push({type: "Removed", role_type: this.type, role_amount: this.count, role_id: this.role_id});
		}
		return changes;
	}
}