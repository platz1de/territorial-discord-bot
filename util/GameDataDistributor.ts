import {WebhookClient} from "discord.js";
import {client} from "../PointManager.js";
import {sendToFeed} from "./ClaimWinFeed.js";
import {ClanGame} from "./ClanGame.js";

let cache: ClanGame[] = [];
let subscribers: { [key: string]: string[] } = {};

export function addToCache(data: string) {
	let message = JSON.parse(data).data;

	//Parse Game Result
	const result: ClanGame = new ClanGame( message );

	//Check that the object has been initialised to non default values
	if ( result.isDefault ) return;
	clearCache();

	const msg = `**${result.clan}**    ${result.map}    ${result.contest ? "2 x " : ""}${result.playerCount}  [${result.prevClanPoints}->${result.currClanPoints}]`;
	sendToSubscribers(result.clan, msg);
	sendToSubscribers("ALL", msg);
	sendToFeed(result.clan, msg, result.playerCount * (result.contest ? 2 : 1), result).catch(() => {});

	cache.push(result);
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

export function getCacheForClan(clan: string): ClanGame[] {
	return cache.filter(entry => entry.clan === clan);
}

export function clearCache() {
	cache = cache.filter(entry => entry.timestamp + 300000 > Date.now()); //5 minutes
}