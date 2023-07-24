import {PermissionFlagsBits, SlashCommandBuilder} from "discord.js";
import {BotUserContext} from "../util/BotUserContext";
import {createConfirmationEmbed, createErrorEmbed} from "../util/EmbedUtil";
import {Command, config} from "../PointManager";

export default {
	slashExclusive: true,
	slashData: new SlashCommandBuilder().setName("endpoint").setDescription("Setup assistent for the tthq endpoint").setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),
	execute: async (context: BotUserContext) => {
		fetch("https://apis.territorial-hq.com/api/Clan/").then(async res => {
			const data = await res.json();
			if (data && Array.isArray(data) && data.length > 0) {
				for (const clan of data) {
					//TODO: Workaround for guild ID being an integer, resulting in being rounded
					if (clan.guildId.toString() === parseInt(context.guild.id).toString()) {
						if (clan.botEndpoint !== config.endpoint_self + context.guild.id + "/") {
							await context.reply(createErrorEmbed(context.user, `❌ This server has the wrong endpoint set on the TTHQ api!\nMake sure the \`Custom Bot HttpGet Endpoint\` field is set to\n\`${config.endpoint_self + context.guild.id + "/"}\`\non https://territorial-hq.com/`));
							return;
						} else {
							await context.reply(createConfirmationEmbed(context.user, `✅ This server is correctly registered on the TTHQ api!`));
						}
						return;
					}
				}
			}
			context.reply(createErrorEmbed(context.user, `❌ This server is not registered on the TTHQ api!\nRegister it on https://territorial-hq.com/ first, or make sure the guild id is correct!`));
		}).catch(async e => {
			console.error(e);
			await context.reply(createErrorEmbed(context.user, "❌ An error occurred while requesting the TTHQ api!"));
		});
	}
} as Command;