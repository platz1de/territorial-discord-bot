import {Snowflake} from "discord.js";
import {config} from "../PointManager";

let lastRefresh = 0;
let guildCache: { [key: Snowflake]: { tag: string, endpoint: string } } = {};
let clanCache: { [key: string]: Snowflake[] } = {};

export function getEndpointStatus(guildId: Snowflake, short: boolean): { success: boolean, message: string } {
	refreshCache();
	if (Object.keys(guildCache).length === 0) {
		return {success: false, message: short ? "❌ The TTHQ api is currently not available!" : "❌ The TTHQ api is currently not available!\nPlease try again later"};
	}
	if (!guildCache.hasOwnProperty(guildId.toString())) {
		return {success: false, message: short ? "❌ This server is not registered on the TTHQ api!" : "❌ This server is not registered on the TTHQ api!\nIf you are registered on https://preview.territorial-hq.com/, make sure the entered guild id is correct!\nOtherwise visit the support server and open a server registration request"};
	}
	if (guildCache[guildId.toString()].endpoint !== config.endpoint_self + guildId + "/") {
		return {success: false, message: short ? "❌ This server has the wrong endpoint set on the TTHQ api!" : "❌ This server has the wrong endpoint set on the TTHQ api!\nPlease go to https://preview.territorial-hq.com/\nand set the `Custom Bot HttpGet Endpoint` field to\n`" + config.endpoint_self + guildId + "/`\nCopy paste the line above as-is"};
	}
	return {success: true, message: "✅ This server is correctly registered on the TTHQ api!"};
}

export function getGuildsForClan(clan: string): Snowflake[] {
	if (clanCache.hasOwnProperty(clan)) {
		return clanCache[clan];
	}
	return [];
}

export function getClanForGuild(guild: Snowflake): string | null {
	if (guildCache.hasOwnProperty(guild.toString())) {
		return guildCache[guild.toString()].tag;
	}
	return null;
}

function refreshCache() {
	if (lastRefresh + 6000 > Date.now()) // 6 seconds
		return;
	lastRefresh = Date.now();
	fetch("https://apis.territorial-hq.com/api/Clan/").then(async res => {
		const data = await res.json();
		if (data && Array.isArray(data) && data.length > 0) {
			guildCache = {};
			clanCache = {};
			let allowedDiscordIds: { [key: Snowflake]: string } = {};
			for (const id in data) {
				const clan = data[id];
				if (!clan.botEndpoint)
					continue;
				if (!allowedDiscordIds[clan.guildId.toString()]) {
					allowedDiscordIds[clan.guildId.toString()] = id;
					continue;
				}
				console.log("Conflict: " + clan.tag + " " + data[parseInt(allowedDiscordIds[clan.guildId.toString()])].tag);
				if (new Date(data[parseInt(allowedDiscordIds[clan.guildId.toString()])].timestamp).getTime() > new Date(clan.timestamp).getTime()) {
					allowedDiscordIds[clan.guildId.toString()] = id;
				}
			}
			for (const id in data) {
				if (allowedDiscordIds[data[id].guildId.toString()] !== id)
					continue;
				guildCache[data[id].guildId.toString()] = {tag: data[id].tag, endpoint: data[id].botEndpoint};
				if (!clanCache.hasOwnProperty(data[id].tag)) {
					clanCache[data[id].tag] = [];
				}
				clanCache[data[id].tag].push(data[id].guildId.toString());
			}
		}
	}).catch(e => {
		console.error(e);
	});
}

refreshCache();

setInterval(refreshCache, 300000); // 5 minutes