import {ChatInputCommandInteraction, Colors, EmbedBuilder, PermissionFlagsBits, SlashCommandBuilder, User} from "discord.js";
import {PointCommand} from "../PointManager.js";
import {createErrorEmbed} from "../util/EmbedUtil.js";
import {createPointTransaction} from "../util/PointTransaction.js";
import {ServerContext} from "../util/ServerContext.js";

export default {
	slashData: new SlashCommandBuilder().setName("modifypoints").setDescription("Modify points of a member")
		.addUserOption(option => option.setName("member").setDescription("The member to modify points from").setRequired(true))
		.addIntegerOption(option => option.setName("type").setDescription("The type of points to modify").setRequired(true).addChoices(
			{name: "Points", value: 0},
			{name: "Wins", value: 1}
		))
		.addIntegerOption(option => option.setName("points").setDescription("The amount of points to modify").setRequired(true))
		.setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),
	execute: async (interaction: ChatInputCommandInteraction, context: ServerContext) => {
		const user: User = interaction.options.getUser("member", true);
		let points: number = interaction.options.getInteger("points", true);
		const type: number = interaction.options.getInteger("type", true);
		if (!context.hasModAccess(interaction)) {
			await interaction.editReply(createErrorEmbed(interaction.user, "❌ You don't have the permission to remove points!"));
			return;
		}
		if (isNaN(points) || points === 0) {
			await interaction.editReply(createErrorEmbed(interaction.user, "⚠ You need to specify a valid amount of points!"));
			return;
		}
		const transaction = await createPointTransaction(user.id, context.guild, null, type === 0 ? points : 0, type === 0 ? 0 : points);
		context.logAction(interaction.user, `Modified ${type === 0 ? "points" : "wins"} from ${user} by ${points}`, Colors.Yellow);
		await interaction.editReply({embeds: [new EmbedBuilder().setAuthor({name: interaction.user.tag, iconURL: interaction.user.displayAvatarURL()}).setDescription(transaction.buildDescription(false)).setTimestamp().setColor(Colors.Yellow).toJSON()]});
	}
} as PointCommand;