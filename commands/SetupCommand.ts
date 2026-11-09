import {ChatInputCommandInteraction, PermissionFlagsBits, SlashCommandBuilder} from "discord.js";
import {GenericCommand} from "../PointManager.js";
import {createErrorEmbed} from "../util/EmbedUtil.js";
import {startDialog} from "../util/SetupDisalogUtil.js";
import {createServerContext} from "../util/ServerContext.js";

export default {
	slashData: new SlashCommandBuilder().setName("setup").setDescription("Start the setup assistant")
		.setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
	execute: async (interaction: ChatInputCommandInteraction) => {
		if (createServerContext(interaction.guild)) {
			await interaction.editReply(createErrorEmbed(interaction.user, "This server has already been set up!"));
			return;
		}
		startDialog(interaction);
	}
} as GenericCommand;