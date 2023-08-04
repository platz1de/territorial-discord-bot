import {createServer} from 'http';
import {verify} from "jsonwebtoken";
import {readFileSync} from "fs";
import {client, db} from '../PointManager';
import {Colors, EmbedBuilder, TextChannel} from "discord.js";
import {format, toRewardString} from "./EmbedUtil";
import {getRawUser} from "./BotUserContext";

const cert = readFileSync("public.key");

createServer(function (r, s) {
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
	} else if (r.url?.match(/\/\d+/) && r.method === "POST") {
		const targetGuild = r.url.split("/")[1];
		const guildUser = getRawUser(targetGuild, "");
		if (!guildUser) {
			s.writeHead(404);
			s.write("Guild not found");
			s.end();
			return;
		}
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
					if (decoded.clan !== targetGuild || !guildUser.context.auto_points) {
						s.writeHead(403);
						s.write("Forbidden");
						s.end();
						return;
					}
					const multiplier = db.getSettingProvider().getMultiplier(guildUser);
					let realPoints = decoded.points;
					if (multiplier) {
						realPoints = Math.ceil(realPoints * multiplier.amount);
					}
					for (const targetClient of decoded.clients) {
						const user = getRawUser(targetGuild, targetClient.username);
						if (!user) continue;
						let channel = client.channels.cache.get(user.context.channel_id[0]);
						user.registerWin(realPoints).then((response) => {
							user.fetchMember().then((member) => {
								if (channel && channel instanceof TextChannel) {
									channel.send({
										embeds: [
											new EmbedBuilder().setAuthor({name: user.user.tag + " via TTHQ", iconURL: user.user.displayAvatarURL()}).setDescription(`Registered win of ${format(decoded.points)} ${multiplier ? `\`x ${multiplier.amount} (multiplier)\` ` : ``}points to <@${user.id}>'s balance` + toRewardString(response, false, false)).setTimestamp().setColor(Colors.Green).setFooter({text: "Action was taken automatically"}).toJSON()
										]
									}).catch(() => {});
								}
							});
						});
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
	} else {
		s.writeHead(405);
		s.write("Method not allowed");
		s.end();
	}
}).listen(34583);

console.log("Listening on port 34583");