import {WebhookClient} from "discord.js";
import {client} from "../PointManager";

let cache: CacheEntry[] = [];
let subscribers: { [key: string]: string[] } = {};

interface CacheEntry {
	clan: string;
	map: string;
	points: number;
	contest: boolean;
	timestamp: number;
}

export function addToCache(data: string) {
	let message = JSON.parse(data).data;
	let match = message.match(/^(\*?\*?)([\w\s]+)\s{4}(\d+)\s{4}(.*)\s\[(\d+)\.(\d{3,4})->(\d+)\.(\d{3,4})](\*?\*?)$/);
	if (!match || match[1] !== match[9]) {
		return;
	}
	clearCache();
	cache.push({
		clan: match[4],
		map: match[2],
		points: parseInt(match[3]),
		contest: match[1].length === 2,
		timestamp: Date.now()
	});

	const msg = `**${match[4]}**    ${match[2]}    ${match[1].length === 2 ? "2 x " : ""}${match[3]}  [${match[5]}.${match[6]}->${match[7]}.${match[8]}]`;
	sendToSubscribers(match[4], msg);
	sendToSubscribers("ALL", msg);
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

export function clearCache() {
	cache = cache.filter(entry => entry.timestamp + 300000 > Date.now()); //5 minutes
}