import {ChatInputCommandInteraction, SlashCommandBuilder} from "discord.js";
import {GenericCommand} from "../PointManager.js";
import {BaseUserContext} from "../util/BaseUserContext.js";

export default {
	slashData: new SlashCommandBuilder().setName("ping").setDescription("Ping!"),
	execute: async (context: BaseUserContext) => {
		const interaction = context.base as ChatInputCommandInteraction;
		await interaction.editReply("Pong!");
	}
} as GenericCommand;