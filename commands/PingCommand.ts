import {ChatInputCommandInteraction, SlashCommandBuilder} from "discord.js";
import {ServerSetting} from "../BotSettingProvider";

export default {
	slashExclusive: true,
	slashData: new SlashCommandBuilder().setName("ping").setDescription("Ping!"),
	execute: async (setting: ServerSetting, interaction: ChatInputCommandInteraction) => {
		await interaction.editReply("Pong!");
	}
}