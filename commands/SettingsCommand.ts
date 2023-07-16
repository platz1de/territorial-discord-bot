import {ActionRowBuilder, ButtonBuilder, ButtonStyle, ChatInputCommandInteraction, Colors, EmbedBuilder, Message, PermissionFlagsBits, SlashCommandBuilder} from "discord.js";
import BotInteraction from "../util/BotInteraction";
import {ServerSetting} from "../BotSettingProvider";

export default {
	slashExclusive: false,
	stringyNames: ["settings", "options", "config", "conf", "st"],
	slashData: new SlashCommandBuilder().setName("settings").setDescription("Change server settings").setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),
	execute: async (setting: ServerSetting, interaction: ChatInputCommandInteraction) => {
		await showSettingsEmbed(setting, new BotInteraction(interaction));
	},
	executeStringy: async (setting: ServerSetting, message: Message) => {
		await showSettingsEmbed(setting, new BotInteraction(message));
	}
}

async function showSettingsEmbed(setting: ServerSetting, interaction: BotInteraction) {
	interaction.reply({
		embeds: [
			new EmbedBuilder().setAuthor({name: interaction.guild.name, iconURL: interaction.guild.iconURL() || undefined})
				.setTitle("Server Settings")
				.addFields([
					{
						name: "❗ Prefix",
						value: `\`${setting.prefix}\`\nUse \`${setting.prefix}setprefix <prefix>\` to change`, inline: true
					},
					{
						name: "🏷️ Roles",
						value: `\`${setting.roles}\` (${setting.roles === "all" ? "Keep all roles a member has unlocked" : "Only the highest role a member unlocked"})\nUse \`${setting.prefix}toggleroles\` to toggle`, inline: true
					},
					{
						name: "👑 Win Channels",
						value: setting.channel_id.map((id) => `<#${id}>`).join("\n") + `\nUse \`${setting.prefix}removechannel <id>\` or \`${setting.prefix}addchannel <id>\` to manage`, inline: true
					},
					{
						name: "📜 Log Channel",
						value: `<#${setting.log_channel_id}>\nUse \`${setting.prefix}setlogchannel <id>\` to change`, inline: true
					},
					{
						name: "📰 Update Channel",
						value: `<#${setting.update_channel_id}>\nUse \`${setting.prefix}setupdatechannel <id>\` to change`, inline: true
					},
					{
						name: "🛠 Mod Roles",
						value: setting.mod_roles.map((id) => `<@&${id}>`).join("\n") + `\nUse \`${setting.prefix}removemodrole <id>\` or \`${setting.prefix}addmodrole <id>\` to manage`, inline: true
					},
					{
						name: "🏆 Reward Roles",
						value: `See all currect reward roles using \`${setting.prefix}roles\`\nUse \`${setting.prefix}removerewardrole <id>\` or \`${setting.prefix}addrewardrole <id> <points|wins> <amount>\` to manage`, inline: true
					}
				])
				.setColor(Colors.Blurple).setFooter({
				text: "All settings can also be changed using /settings",
			}).setTimestamp().toJSON()
		]
	}).catch(console.error)
}