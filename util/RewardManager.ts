import {Colors, GuildMember, Snowflake} from "discord.js";
import {db, logAction} from "../PointManager";
import {getSettingProvider} from "../db/DataBaseManager";

let rewards: Reward[] = [];
let hierarchy: number[] = [];

interface RewardAnswer {
	type: string,
	description: string,
	role_id: string
}

function getRewardList(): Reward[] {
	return rewards;
}

async function calculateEligibleRoles(member: GuildMember) {
	const total = await db.getGlobalProvider().getData(member);
	const roles: Reward[] = [];
	for (const reward of rewards) {
		if (reward.type === "special") continue;
		if (total[reward.type] >= reward.count) {
			roles.push(reward);
		}
	}
	return roles;
}

function filterByHierarchy(roles: Reward[]): Reward[] {
	let highest = {season: {wins: -1, points: -1}, total: {wins: -1, points: -1}};
	for (const role of roles) {
		const index = hierarchy.findIndex(r => r === rewards.findIndex(r => r.role_id === role.role_id));
		if (index === -1) {
			throw new Error("Reward not found in hierarchy");
		}
		if (role.type === "special") {
			throw new Error("Special role found in hierarchy");
		}
		if (index > highest[role.dur][role.type]) {
			highest[role.dur][role.type] = index;
		}
	}
	let filtered: Reward[] = [];
	filtered.push(rewards[hierarchy[highest.season.wins]]);
	filtered.push(rewards[hierarchy[highest.season.points]]);
	filtered.push(rewards[hierarchy[highest.total.wins]]);
	filtered.push(rewards[hierarchy[highest.total.points]]);
	return filtered;
}

async function getProgress(member: GuildMember): Promise<{ role: Snowflake, has: number, needs: number }[]> {
	const total = await db.getGlobalProvider().getData(member);
	const progress: { role: Snowflake, has: number, needs: number }[] = [];
	for (const id of hierarchy) {
		const reward = rewards[id];
		if (reward.type === "special") continue;
		if (total[reward.type] < reward.count) {
			if (progress[(reward.dur === "total" ? 0 : 2) + (reward.type === "points" ? 0 : 1)]) continue;
			progress[(reward.dur === "total" ? 0 : 2) + (reward.type === "points" ? 0 : 1)] = {role: reward.role_id, has: total[reward.type], needs: reward.count};
		}
	}
	return progress;
}

function loadRewards(rewardData: { description: string, req_desc: string, role_id: string, type: "wins" | "points" | "special", dur: "season" | "total", count: number, category: string }[]) {
	let cache: { season: { wins: number[], points: number[] }, total: { wins: number[], points: number[] } } = {season: {wins: [], points: []}, total: {wins: [], points: []}};
	for (const data of rewardData) {
		rewards.push(new Reward(data.description, data.req_desc, data.role_id, data.type, data.dur, data.count, data.category));
		data.type !== "special" && cache[data.dur][data.type].push(rewards.length - 1);
	}
	cache.season.wins.sort((a, b) => rewards[a].count - rewards[b].count);
	cache.season.points.sort((a, b) => rewards[a].count - rewards[b].count);
	cache.total.wins.sort((a, b) => rewards[a].count - rewards[b].count);
	cache.total.points.sort((a, b) => rewards[a].count - rewards[b].count);
	hierarchy = cache.season.wins.concat(cache.season.points).concat(cache.total.wins).concat(cache.total.points);
}

function checkChanges(member: GuildMember, type: string, dur: string, from: number, to: number): RewardAnswer[] {
	let changes: RewardAnswer[] = [];
	for (const reward of rewards) {
		changes = reward.checkChange(member, type, dur, from, to, changes);
	}

	if (getSettingProvider().getUserSetting(member.id).roles === "highest") {
		setTimeout(() => applyHierarchy(member, changes), 2000);
	}

	return changes;
}

function applyHierarchy(member: GuildMember, changes: RewardAnswer[]) {
	if (changes.length === 0) return;
	if (changes[0].type === "Added") {
		for (const reward of changes) {
			const index = hierarchy.findIndex(r => r === rewards.findIndex(r => r.role_id === reward.role_id));
			if (index === -1) {
				throw new Error("Reward not found in hierarchy");
			}
			const replace = hierarchy[index - 1] || -1;
			if (replace !== -1) {
				if (rewards[replace].type !== rewards.find(r => r.role_id === reward.role_id)?.type || rewards[replace].dur !== rewards.find(r => r.role_id === reward.role_id)?.dur) {
					continue;
				}
				console.log(`Replacing ${rewards[replace].role_id} with ${reward.role_id}`);
				member.roles.remove(rewards[replace].role_id, "Meets higher criteria").then().catch(console.error);
			}
		}
	} else {
		let lowest = -1;
		for (const reward of changes) {
			const index = hierarchy.findIndex(r => r === rewards.findIndex(r => r.role_id === reward.role_id));
			if (index === -1) {
				throw new Error("Reward not found in hierarchy");
			}
			if (index > lowest) {
				lowest = index;
			}
		}
		const replace = hierarchy[lowest - 1] || -1;
		if (replace !== -1) {
			if (rewards[replace].type !== rewards.find(r => r.role_id === changes[0].role_id)?.type || rewards[replace].dur !== rewards.find(r => r.role_id === changes[0].role_id)?.dur) {
				return;
			}
			member.roles.add(rewards[replace].role_id, "No longer meets higher criteria").catch(console.error);
		}
	}
}

function normalizeChanges(changes: RewardAnswer[], add: RewardAnswer[]): RewardAnswer[] {
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

class Reward {
	description: string;
	req_desc: string;
	role_id: string;
	type: "wins" | "points" | "special";
	dur: "total" | "season";
	count: number;
	category: string;

	constructor(description: string, req_desc: string, role_id: string, type: "points" | "wins" | "special", dur: "season" | "total", count: number, category: string = "Other") {
		this.description = description;
		this.req_desc = req_desc;
		this.role_id = role_id;
		this.type = type;
		this.dur = dur;
		this.count = count;
		this.category = category;
	}

	checkChange(member: GuildMember, type: string, dur: string, from: number, to: number, changes: RewardAnswer[]) {
		if (this.type !== type || this.dur !== dur) return changes;
		if (from < this.count && to >= this.count) {
			member.roles.add(this.role_id, "Reward for " + this.req_desc).then(() => {
				logAction(member, "Added role <@&" + this.role_id + "> for " + this.req_desc, Colors.Blurple);
			}).catch(console.error);
			changes.push(this.getPosChangeData());
		} else if (from >= this.count && to < this.count) {
			member.roles.remove(this.role_id, "Reward for " + this.req_desc + " was removed do to no longer meeting the requirement").then(() => {
				logAction(member, "Removed role <@&" + this.role_id + "> for no longer meeting criteria", Colors.Blurple);
			});
			changes.push(this.getNegChangeData());
		}
		return changes;
	}

	getPosChangeData() {
		return {type: "Added", description: this.req_desc, role_id: this.role_id};
	}

	getNegChangeData() {
		return {type: "Removed", description: this.req_desc, role_id: this.role_id};
	}
}

export {loadRewards, checkChanges, normalizeChanges, Reward, RewardAnswer, getRewardList, calculateEligibleRoles, filterByHierarchy, getProgress};