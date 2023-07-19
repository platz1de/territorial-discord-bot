import {Colors, Snowflake} from "discord.js";
import {logAction} from "../PointManager";
import {ServerSetting} from "../BotSettingProvider";
import {BotUserContext} from "./BotUserContext";

let rewards: { [key: string]: Reward[] } = {};
let hierarchy: { [key: string]: number[] } = {};

export interface RewardAnswer {
	type: string,
	role_type: string,
	role_amount: number,
	role_id: string
}

export function getRewardList(context: BotUserContext): Reward[] {
	let list: Reward[] = [];
	for (const reward of hierarchy[context.guild.id]) {
		list.push(rewards[context.guild.id][reward]);
	}
	return list;
}

export async function calculateEligibleRoles(context: BotUserContext) {
	const total = await context.getData();
	const roles: Reward[] = [];
	for (const reward of rewards[context.guild.id]) {
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

export async function getProgress(context: BotUserContext): Promise<{ role: Snowflake, has: number, needs: number }[]> {
	const total = await context.getData();
	const progress: { role: Snowflake, has: number, needs: number }[] = [];
	for (const id of hierarchy[context.guild.id]) {
		const reward = rewards[context.guild.id][id];
		if (total[reward.type] < reward.count) {
			if (progress[(reward.type === "points" ? 0 : 1)]) continue;
			progress[(reward.type === "points" ? 0 : 1)] = {role: reward.role_id, has: total[reward.type], needs: reward.count};
		}
	}
	return progress;
}

export function loadRewards(setting: ServerSetting) {
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

export function checkChanges(context: BotUserContext, type: string, from: number, to: number): RewardAnswer[] {
	let changes: RewardAnswer[] = [];
	for (const reward of rewards[context.guild.id]) {
		changes = reward.checkChange(context, type, from, to, changes);
	}

	if (context.context.roles === "highest") {
		setTimeout(() => applyHierarchy(context, changes), 2000);
	}

	return changes;
}

function applyHierarchy(context: BotUserContext, changes: RewardAnswer[]) {
	if (changes.length === 0 || !context.member) return;
	let lowestPoints = -1;
	let lowestWins = -1;
	for (const reward of changes) {
		const index = hierarchy[context.guild.id].findIndex(r => r === rewards[context.guild.id].findIndex(r => r.role_id === reward.role_id));
		if (index === -1) {
			throw new Error("Reward not found in hierarchy");
		}
		if (rewards[context.guild.id][index].type === "points" && index < lowestPoints) {
			lowestPoints = index;
		} else if (rewards[context.guild.id][index].type === "wins" && index < lowestWins) {
			lowestWins = index;
		}
	}
	const replacePoints = hierarchy[context.guild.id][lowestPoints - 1] || -1;
	const replaceWins = hierarchy[context.guild.id][lowestWins - 1] || -1;
	if (changes[0].type === "Added") {
		if (replacePoints !== -1 && rewards[context.guild.id][replacePoints].type === "points") {
			context.member.roles.remove(rewards[context.guild.id][replacePoints].role_id, "Meets higher criteria").then().catch(console.error);
		}
		if (replaceWins !== -1 && rewards[context.guild.id][replaceWins].type === "wins") {
			context.member.roles.remove(rewards[context.guild.id][replaceWins].role_id, "Meets higher criteria").then().catch(console.error);
		}
	} else {
		if (replacePoints !== -1 && rewards[context.guild.id][lowestPoints].type === "points") {
			context.member.roles.add(rewards[context.guild.id][lowestPoints].role_id, "No longer meets higher criteria").then().catch(console.error);
		}
		if (replaceWins !== -1 && rewards[context.guild.id][lowestWins].type === "wins") {
			context.member.roles.add(rewards[context.guild.id][lowestWins].role_id, "No longer meets higher criteria").then().catch(console.error);
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

	checkChange(context: BotUserContext, type: string, from: number, to: number, changes: RewardAnswer[]) {
		if (this.type !== type || !context.member) return changes;
		if (from < this.count && to >= this.count) {
			context.member.roles.add(this.role_id, `Reward for reaching ${this.count} ${this.type}`).then(() => {
				logAction(context, `Added role <@&${this.role_id}> for reaching ${this.count} ${this.type}`, Colors.Blurple);
			}).catch(console.error);
			changes.push({type: "Added", role_type: this.type, role_amount: this.count, role_id: this.role_id});
		} else if (from >= this.count && to < this.count) {
			context.member.roles.remove(this.role_id, `Reward for reaching ${this.count} ${this.type} was removed do to no longer meeting the requirement`).then(() => {
				logAction(context, `Removed role <@&${this.role_id}> for no longer meeting criteria`, Colors.Blurple);
			});
			changes.push({type: "Removed", role_type: this.type, role_amount: this.count, role_id: this.role_id});
		}
		return changes;
	}
}