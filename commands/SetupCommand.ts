import {PermissionFlagsBits, SlashCommandBuilder} from "discord.js";
import {GenericCommand} from "../PointManager";
import {BotUserContext} from "../util/BotUserContext";
import {BaseUserContext} from "../util/BaseUserContext";
import {createErrorEmbed} from "../util/EmbedUtil";
import {startDialog} from "../util/SetupDisalogUtil";

export default {
	slashData: new SlashCommandBuilder().setName("setup").setDescription("Start the setup assistant")
		.setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
	execute: async (context: BaseUserContext) => {
		if (context instanceof BotUserContext) {
			await context.reply(createErrorEmbed(context.user, "This server has already been set up!"));
			return;
		}
		startDialog(context);
	}
} as GenericCommand;