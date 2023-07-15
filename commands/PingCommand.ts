import {ChatInputCommandInteraction, SlashCommandBuilder} from "discord.js";

export default {
	slashExclusive: true,
	slashData: new SlashCommandBuilder().setName("ping").setDescription("Ping!"),
	execute: async (interaction: ChatInputCommandInteraction) => {
		await interaction.editReply("Pong!");
	}
}