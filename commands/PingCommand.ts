import {SlashCommandBuilder} from "discord.js";
import {BotUserContext} from "../util/BotUserContext";
import {Command} from "../PointManager";

export default {
	slashExclusive: true,
	slashData: new SlashCommandBuilder().setName("ping").setDescription("Ping!"),
	execute: async (context: BotUserContext) => {
		await context.reply("Pong!");
	}
} as Command;