import {createServer} from 'http';
import {verify} from "jsonwebtoken";
import {readFileSync} from "fs";
import {client, db} from '../PointManager';
import {Colors, EmbedBuilder, TextChannel} from "discord.js";
import {format, toRewardString} from "./EmbedUtil";
import {getRawUser} from "./BotUserContext";
import {getGuildsForClan} from "../BotSettingProvider";
import {getTTClanLeaderboard, getTTPlayerLeaderboard} from "./DataPredictions";

const cert = readFileSync("public.key");

export const server = createServer(function (r, s) {
	if (r.url?.match(/\/\d+\/\d+/) && r.method === "GET") {
		const targetGuild = r.url.split("/")[1];
		const targetUser = r.url.split("/")[2];
		const user = getRawUser(targetGuild, targetUser);
		if (!user) {
			s.writeHead(404);
			s.write("Guild not found");
			s.end();
			return;
		}
		user.getData().then((data) => {
			if (data.points === 0) {
				s.writeHead(404);
				s.write("User not found");
				s.end();
				return;
			}
			s.writeHead(200);
			s.write(data.points.toString());
			s.end();
		}).catch(() => {
			s.writeHead(404);
			s.write("User not found");
			s.end();
		});
	} else if (r.url?.match(/\//) && r.method === "POST") {
		let body = "";
		r.on("data", (chunk) => {
			body += chunk;
		});
		r.on("end", () => {
			try {
				verify(body, cert, function (err, decoded) {
					if (err || !decoded) {
						s.writeHead(401);
						s.write("Unauthorized");
						s.end();
						return;
					}
					if (typeof decoded !== "object" || !decoded.points || !decoded.clients || typeof decoded.points !== "number" || typeof decoded.clan !== "string" || !Array.isArray(decoded.clients) || decoded.clients.length === 0) {
						s.writeHead(400);
						s.write("Bad request");
						s.end();
						return;
					}
					const guilds = getGuildsForClan(decoded.clan);
					for (const guild of guilds) {
						const guildUser = getRawUser(guild, "");
						if (!guildUser) continue;
						if (guildUser.context.auto_points) {
							const multiplier = db.getSettingProvider().getMultiplier(guildUser);
							let realPoints = decoded.points;
							if (multiplier) {
								realPoints = Math.ceil(realPoints * multiplier.amount);
							}
							for (const targetClient of decoded.clients) {
								const user = getRawUser(guild, targetClient.username);
								if (!user) continue;
								let channel = client.channels.cache.get(user.context.channel_id[0]);
								user.registerWin(realPoints).then((response) => {
									user.fetchMember().then((member) => {
										if (channel && channel instanceof TextChannel) {
											channel.send({
												embeds: [
													new EmbedBuilder().setAuthor({name: user.user.tag + " via BetterTT", iconURL: user.user.displayAvatarURL()}).setDescription(`Registered win of ${format(decoded.points)} ${multiplier ? `\`x ${multiplier.amount} (multiplier)\` ` : ``}points to <@${user.id}>'s balance` + toRewardString(response, false, false)).setTimestamp().setColor(Colors.Green).setFooter({text: "Action was taken automatically"}).toJSON()
												]
											}).catch(() => {});
										}
									});
								});
							}
						}
					}
					s.writeHead(200);
					s.write("OK");
					s.end();
				});
			} catch (e) {
				s.writeHead(400);
				s.write("Bad request");
				s.end();
			}
		});
	} else if (r.url?.match(/^\/leaderboard\/(?:players|clans)\//) && r.method === "GET") {
		let type = r.url.split("/")[2];
		let query = r.url.substring(r.url.indexOf("?") + 1);
		let page = 1;
		let search = "";
		for (const param of query.split("&")) {
			const key = param.split("=")[0];
			const value = param.split("=")[1];
			if (key === "page") {
				page = Math.max(1, parseInt(value));
			} else if (key === "search") {
				search = decodeURIComponent(value).toLowerCase();
			}
		}
		s.writeHead(200, {"Content-Type": "application/json", "Access-Control-Allow-Origin": "*"});
		s.write(JSON.stringify(type === "players" ? getTTPlayerLeaderboard(page, search) : getTTClanLeaderboard(page, search)));
		s.end();
	} else if (r.url === "/status/" && r.method === "GET") {
		s.writeHead(200, {"Content-Type": "application/text", "Access-Control-Allow-Origin": "*"});
		s.write("OK");
		s.end();
	} else {
		s.writeHead(405);
		s.write("Method not allowed");
		s.end();
	}
}).listen(34583);

console.log("Listening on port 34583");