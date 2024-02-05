import {WebhookClient} from "discord.js";
import {client} from "../PointManager";
import {sendToFeed} from "./ClaimWinFeed";
import {setClanScore, tryHandlePlayerData} from "./DataPredictions";

let cache: CacheEntry[] = [];
let subscribers: { [key: string]: string[] } = {};

interface CacheEntry {
	clans: { [key: string]: number };
	teamCount: number;
	map: string;
	playerCount: number;
	contest: boolean;
	timestamp: number;
}

export function addToCache(data: string) {
	let message = JSON.parse(data).data;
	let match = message.match(/^```Time:\s{9}.*\sGame\sMode:\s{4}(\d)\sTeams((?:,\sContest)?)\sMap:\s{10}([\w\s]+)\sPlayer Count:\s(\d+)\sTeam\sT:\s{7}(\d+)\sPercentage\sL:\s\d*\.\d*\sRes:((?:\s{4}\[[^\]]+]:[\s.+=,T\d]+\(\s*\d+\.\d+%\))+)```$/);
	if (!match) {
		tryHandlePlayerData(message);
		return;
	}
	clearCache();
	let clans = match[6].matchAll(/\s{3}\[([^\]]+)]:\s*(\d*\.\d*)\s*\+\s*\d*\.\d*\s*=\s*(\d*\.\d*),\s*T\s*=\s*(\d*)\s*\(\s*\d*\d\.\d*%\)/g);
	let winClans: { [key: string]: number } = {};
	for (const clan of clans) {
		const points = Math.round((parseInt(clan[4]) * (match[2] === ", Contest" ? 2 : 1) * parseInt(match[4]) / parseInt(match[5])) * 100) / 100;
		winClans[clan[1]] = points;
		setClanScore(clan[1], clan[3]);

		const msg = `**${clan[1]}**    ${match[1]} Team  ${match[3]}    ${points}  [${clan[2]}->${clan[3]}]`;
		sendToSubscribers(clan[1], msg);
		sendToSubscribers("ALL", msg);
		sendToFeed(clan[1], msg, points).catch(() => {});
	}
	cache.push({
		clans: winClans,
		teamCount: parseInt(match[1]),
		map: match[3],
		playerCount: parseInt(match[4]),
		contest: match[2] === ", Contest",
		timestamp: Date.now()
	});
}

function sendToSubscribers(clan: string, message: string) {
	for (const webhook of subscribers[clan] || []) {
		const wh = new WebhookClient({url: webhook});
		wh.send({
			content: message,
			username: client.user?.username,
			avatarURL: client.user?.displayAvatarURL()
		}).catch(() => {});
	}
}

export function subscribe(clan: string, webhook: string) {
	if (!subscribers.hasOwnProperty(clan)) {
		subscribers[clan] = [];
	}
	if (!subscribers[clan].includes(webhook)) {
		subscribers[clan].push(webhook);
	}
}

export function unsubscribe(clan: string, webhook: string) {
	if (subscribers.hasOwnProperty(clan)) {
		subscribers[clan] = subscribers[clan].filter(w => w !== webhook);
	}
}

export function getCacheForClan(clan: string): CacheEntry[] {
	return cache.filter(entry => entry.clans.hasOwnProperty(clan));
}

export function clearCache() {
	cache = cache.filter(entry => entry.timestamp + 300000 > Date.now()); //5 minutes
}