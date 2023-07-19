import {ChatInputCommandInteraction, Colors, EmbedBuilder, PermissionFlagsBits, SlashCommandBuilder, User} from "discord.js";
import {Command, logAction} from "../PointManager";
import {createErrorEmbed, format, toRewardString} from "../util/EmbedUtil";
import {BotUserContext, getRawUser} from "../util/BotUserContext";

export default {
	slashExclusive: true,
	slashData: new SlashCommandBuilder().setName("modifypoints").setDescription("Modify points of a member")
		.addUserOption(option => option.setName("member").setDescription("The member to modify points from").setRequired(true))
		.addIntegerOption(option => option.setName("type").setDescription("The type of points to remove").setRequired(true).addChoices(
			{name: "Points", value: 0},
			{name: "Wins", value: 1}
		))
		.addIntegerOption(option => option.setName("points").setDescription("The amount of points to add/remove").setRequired(true))
		.setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),
	execute: async (context: BotUserContext) => {
		const interaction = context.base as ChatInputCommandInteraction;
		const user: User = interaction.options.getUser("member", true);
		let points: number = interaction.options.getInteger("points", true);
		const type: number = interaction.options.getInteger("type", true);
		if (!context.hasModAccess()) {
			await interaction.editReply(createErrorEmbed(interaction.user, "❌ You don't have the permission to remove points!"));
			return;
		}
		if (isNaN(points) || points === 0) {
			await interaction.editReply(createErrorEmbed(interaction.user, "⚠ You need to specify a valid amount of points!"));
			return;
		}
		const response = type === 0 ? await getRawUser(context.guild.id, user.id)?.modifyPoints(points) : await getRawUser(context.guild.id, user.id)?.modifyWins(points);
		logAction(context, `Modified ${type === 0 ? "points" : "wins"} from ${user} by ${points}`, Colors.Yellow);
		await interaction.editReply({embeds: [new EmbedBuilder().setAuthor({name: interaction.user.tag, iconURL: interaction.user.displayAvatarURL()}).setDescription(`Modified ${type === 0 ? "points" : "wins"} from ${user} by ${format(points)}` + toRewardString(response || [], false, false)).setTimestamp().setColor(Colors.Yellow).toJSON()]});
	}
} as Command;