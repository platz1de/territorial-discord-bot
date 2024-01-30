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
	let match = message.match(/^(\*?\*?)Game\sMode:\s(\d)\sTeams\s{3}Map:\s([\w\s]+)\s{3}Player\sCount:\s(\d+)\s{3}Result:((?:\s\[[^\]]*]:\s\d+\.\d+->\d+\.\d+)+)(\*?\*?)$/);
	if (!match || match[1] !== match[6]) {
		tryHandlePlayerData(message);
		return;
	}
	clearCache();
	let clans = match[5].matchAll(/\[([^\]]*)]:\s(\d+\.\d+)->(\d+\.\d+)/g);
	let winClans: { [key: string]: number } = {};
	for (const clan of clans) {
		winClans[clan[1]] = 0; //hopefully we get the result for each clan soon
		setClanScore(clan[1], clan[3]);
	}
	cache.push({
		clans: winClans,
		teamCount: parseInt(match[2]),
		map: match[3],
		playerCount: parseInt(match[4]),
		contest: match[1].length === 2,
		timestamp: Date.now()
	});

	//const msg = `**${match[4]}**    ${match[2]}    ${match[1].length === 2 ? "2 x " : ""}${match[3]}  [${match[5]}.${match[6]}->${match[7]}.${match[8]}]`;
	//sendToSubscribers(match[4], msg);
	//sendToSubscribers("ALL", msg);
	//sendToFeed(match[4], msg, parseInt(match[3]) * (match[1].length === 2 ? 2 : 1)).catch(() => {});
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