import {PermissionFlagsBits, SlashCommandBuilder} from "discord.js";
import {BotUserContext} from "../util/BotUserContext";
import {createConfirmationEmbed, createErrorEmbed} from "../util/EmbedUtil";
import {PointCommand} from "../PointManager";
import {getEndpointStatus} from "../util/TTHQ";

export default {
	slashData: new SlashCommandBuilder().setName("endpoint").setDescription("Setup assistant for the TTHQ endpoint").setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
	execute: async (context: BotUserContext) => {
		let status = getEndpointStatus(context.guild.id, false);
		if (!status.success) {
			await context.reply(createErrorEmbed(context.user, status.message));
		} else {
			await context.reply(createConfirmationEmbed(context.user, status.message));
		}
	}
} as PointCommand;