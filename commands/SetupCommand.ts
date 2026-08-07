import {PermissionFlagsBits, SlashCommandBuilder} from "discord.js";
import {GenericCommand} from "../PointManager.js";
import {BotUserContext} from "../util/BotUserContext.js";
import {BaseUserContext} from "../util/BaseUserContext.js";
import {createErrorEmbed} from "../util/EmbedUtil.js";
import {startDialog} from "../util/SetupDisalogUtil.js";

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