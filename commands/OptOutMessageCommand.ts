import {SlashCommandBuilder} from "discord.js";
import {Command, db} from "../PointManager";
import {BotUserContext} from "../util/BotUserContext";

export default {
	slashExclusive: true,
	slashData: new SlashCommandBuilder().setName("optoutmessages").setDescription("Opt out from parsing your messages"),
	execute: async (context: BotUserContext) => {
		db.getSettingProvider().toggleOptOut(context.user.id);
		if (db.getSettingProvider().isOptedOut(context.user.id)) {
			await context.reply("✅ Your messages will no longer be parsed!\nNote that the bot will only respond to slash commands from now on.");
		} else {
			await context.reply("✅ Your messages will now be parsed again!\nNormal commands will work again.");
		}
	}
} as Command;