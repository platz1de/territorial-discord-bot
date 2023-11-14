import {SlashCommandBuilder} from "discord.js";
import {GenericCommand} from "../PointManager";
import {BaseUserContext} from "../util/BaseUserContext";

export default {
	slashData: new SlashCommandBuilder().setName("ping").setDescription("Ping!"),
	execute: async (context: BaseUserContext) => {
		await context.reply("Pong!");
	}
} as GenericCommand;