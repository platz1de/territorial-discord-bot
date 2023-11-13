import {PermissionFlagsBits, SlashCommandBuilder} from "discord.js";
import {BotUserContext} from "../util/BotUserContext";
import {createConfirmationEmbed, createErrorEmbed} from "../util/EmbedUtil";
import {Command, config} from "../PointManager";

export default {
	slashExclusive: true,
	slashData: new SlashCommandBuilder().setName("endpoint").setDescription("Setup assistant for the TTHQ endpoint").setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
	execute: async (context: BotUserContext) => {
		fetch("https://apis.territorial-hq.com/api/Clan/").then(async res => {
			const data = await res.json();
			if (data && Array.isArray(data) && data.length > 0) {
				for (const clan of data) {
					if (clan.guildId.toString() === context.guild.id) {
						if (clan.botEndpoint !== config.endpoint_self + context.guild.id + "/") {
							await context.reply(createErrorEmbed(context.user, `❌ This server has the wrong endpoint set on the TTHQ api!\nPlease go to https://preview.territorial-hq.com/\nand set the \`Custom Bot HttpGet Endpoint\` field to\n\`${config.endpoint_self + context.guild.id + "/"}\`\nCopy paste the line above as-is`));
							return;
						} else {
							await context.reply(createConfirmationEmbed(context.user, `✅ This server is correctly registered on the TTHQ api!`));
						}
						return;
					}
				}
			}
			context.reply(createErrorEmbed(context.user, `❌ This server is not registered on the TTHQ api!\nIf you are registered on https://preview.territorial-hq.com/, make sure the entered guild id is correct!\nOtherwise visit the support server and open a server registration request`));
		}).catch(async e => {
			console.error(e);
			await context.reply(createErrorEmbed(context.user, "❌ An error occurred while requesting the TTHQ api!"));
		});
	}
} as Command;