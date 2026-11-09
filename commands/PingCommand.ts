import {ChatInputCommandInteraction, SlashCommandBuilder} from "discord.js";
import {GenericCommand} from "../PointManager.js";

export default {
	slashData: new SlashCommandBuilder().setName("ping").setDescription("Ping!"),
	execute: async (interaction: ChatInputCommandInteraction) => {
		await interaction.editReply("Pong!");
	}
} as GenericCommand;