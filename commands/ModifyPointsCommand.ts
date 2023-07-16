import {ChatInputCommandInteraction, Colors, EmbedBuilder, Guild, GuildMember, PermissionFlagsBits, SlashCommandBuilder, User} from "discord.js";
import {db, hasModAccess, logAction} from "../PointManager";
import {createErrorEmbed, format, toRewardString} from "../util/EmbedUtil";
import {ServerSetting} from "../BotSettingProvider";

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
	execute: async (setting: ServerSetting, interaction: ChatInputCommandInteraction) => {
		if (!(interaction.member instanceof GuildMember) || !(interaction.guild instanceof Guild)) throw new Error("Member not found");
		const user: User = interaction.options.getUser("member", true);
		const member: GuildMember = await interaction.guild.members.fetch(user);
		let points: number = interaction.options.getInteger("points", true);
		const type: number = interaction.options.getInteger("type", true);
		if (!hasModAccess(setting, interaction.member)) {
			await interaction.editReply(createErrorEmbed(interaction.user, "❌ You don't have the permission to remove points!"));
			return;
		}
		if (isNaN(points) || points === 0) {
			await interaction.editReply(createErrorEmbed(interaction.user, "⚠ You need to specify a valid amount of points!"));
			return;
		}
		let response;
		switch (type) {
			case 0:
				if (points < 0) points = -Math.min((await db.getGlobalProvider().getPoints(setting, member)), -points);
				response = await db.modifyPoints(setting, member, points);
				break;
			case 1:
				if (points < 0) points = -Math.min((await db.getGlobalProvider().getWins(setting, member)), -points);
				response = await db.modifyWins(setting, member, points);
				break;
			default:
				throw new Error("Invalid type");
		}
		logAction(setting, interaction.member, `Modified ${type === 0 ? "points" : "wins"} from ${member} by ${points}`, Colors.Yellow);
		await interaction.editReply({embeds: [new EmbedBuilder().setAuthor({name: interaction.user.tag, iconURL: interaction.user.displayAvatarURL()}).setDescription(`Modified ${type === 0 ? "points" : "wins"} from ${member} by ${format(points)}` + toRewardString(response.reward || [], false, false)).setTimestamp().setColor(Colors.Yellow).toJSON()]});
	}
}