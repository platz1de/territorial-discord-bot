import {ChatInputCommandInteraction, Colors, EmbedBuilder, GuildChannel, Message, NewsChannel, PermissionFlagsBits, SlashCommandBuilder, TextChannel} from "discord.js";
import BotInteraction from "../util/BotInteraction";
import {ServerSetting, setServerSetting} from "../BotSettingProvider";
import {rewards} from "../PointManager";

const settingNames = ["setprefix", "toggleroles", "addchannel", "removechannel", "setlogchannel", "setupdatechannel", "addmodrole", "removemodrole", "addrewardrole", "removerewardrole"];

export default {
	slashExclusive: false,
	stringyNames: ["settings", "setting", "options", "config", "conf", "st", ...settingNames],
	slashData: new SlashCommandBuilder().setName("settings").setDescription("Change server settings")
		.addSubcommand(sub => sub.setName("setprefix").setDescription("Change the prefix of the bot").addStringOption(option => option.setName("prefix").setDescription("The new prefix").setRequired(true)))
		.addSubcommand(sub => sub.setName("toggleroles").setDescription("Toggle the roles menu"))
		.addSubcommand(sub => sub.setName("addchannel").setDescription("Add a channel to the channel whitelist").addChannelOption(option => option.setName("channel").setDescription("The channel to add").setRequired(true)))
		.addSubcommand(sub => sub.setName("removechannel").setDescription("Remove a channel from the channel whitelist").addChannelOption(option => option.setName("channel").setDescription("The channel to remove").setRequired(true)))
		.addSubcommand(sub => sub.setName("setlogchannel").setDescription("Set the log channel").addChannelOption(option => option.setName("channel").setDescription("The channel to set").setRequired(true)))
		.addSubcommand(sub => sub.setName("setupdatechannel").setDescription("Set the update channel").addChannelOption(option => option.setName("channel").setDescription("The channel to set").setRequired(true)))
		.addSubcommand(sub => sub.setName("addmodrole").setDescription("Add a role to the mod roles").addRoleOption(option => option.setName("role").setDescription("The role to add").setRequired(true)))
		.addSubcommand(sub => sub.setName("removemodrole").setDescription("Remove a role from the mod roles").addRoleOption(option => option.setName("role").setDescription("The role to remove").setRequired(true)))
		.addSubcommand(sub => sub.setName("addrewardrole").setDescription("Add a role to the reward roles").addRoleOption(option => option.setName("role").setDescription("The role to add").setRequired(true)).addIntegerOption(option => option.setName("type").setDescription("The type of reward").setRequired(true).addChoices({name: "Points", value: 0}, {name: "Wins", value: 1})).addIntegerOption(option => option.setName("amount").setDescription("The amount of points or wins required").setRequired(true)))
		.addSubcommand(sub => sub.setName("removerewardrole").setDescription("Remove a role from the reward roles").addRoleOption(option => option.setName("role").setDescription("The role to remove").setRequired(true)))
		.addSubcommand(sub => sub.setName("show").setDescription("Show the current settings"))
		.setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
	execute: async (setting: ServerSetting, interaction: ChatInputCommandInteraction) => {
		const sub = interaction.options.getSubcommand();
		const index = settingNames.indexOf(sub);
		if (index === -1) {
			await showSettingsEmbed(setting, new BotInteraction(interaction));
			return;
		}
		await handleSetting(setting, new BotInteraction(interaction), index);
	},
	executeStringy: async (setting: ServerSetting, message: Message) => {
		if (!message.member?.permissions.has(PermissionFlagsBits.ManageRoles)) {
			await message.channel.send("You don't have permission to do that!");
			return;
		}
		const settingName = message.content.split(" ")[0].toLowerCase().substring(setting.prefix.length);
		const index = settingNames.indexOf(settingName);
		if (index === -1) {
			await showSettingsEmbed(setting, new BotInteraction(message));
			return;
		}
		await handleSetting(setting, new BotInteraction(message), index);
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

async function handleSetting(setting: ServerSetting, botInteraction: BotInteraction, index: number) {
	if (index === 0) {
		const prefix = botInteraction.base instanceof ChatInputCommandInteraction ? botInteraction.base.options.getString("prefix", true) : botInteraction.base.content.split(" ")[1] || "";
		if (prefix.length >= 10) {
			await botInteraction.reply("Prefix must be less than 10 characters!");
			return;
		}
		setting.prefix = prefix;
		await botInteraction.reply(`Set prefix to \`${prefix}\``);
	} else if (index === 1) {
		setting.roles = setting.roles === "all" ? "highest" : "all";
		await botInteraction.reply(`Set roles to \`${setting.roles}\``);
	} else if (index <= 5) {
		let channel = botInteraction.base instanceof ChatInputCommandInteraction ? botInteraction.base.options.getChannel("channel", true) : botInteraction.guild.channels.cache.get((botInteraction.base.content.split(" ")[1] || "").replace(/<#|>/g, "") || "");
		if (!(channel instanceof TextChannel || channel instanceof NewsChannel)) {
			await botInteraction.reply("Invalid channel!");
			return;
		}
		switch (index) {
			case 2:
				if (setting.channel_id.includes(channel.id)) {
					await botInteraction.reply("That channel is already in the whitelist!");
					return;
				}
				setting.channel_id.push(channel.id);
				await botInteraction.reply(`Added <#${channel.id}> to the whitelist!`);
				break;
			case 3:
				if (!setting.channel_id.includes(channel.id)) {
					await botInteraction.reply("That channel isn't in the whitelist!");
					return;
				}
				setting.channel_id.splice(setting.channel_id.indexOf(channel.id), 1);
				await botInteraction.reply(`Removed <#${channel.id}> from the whitelist!`);
				break;
			case 4:
				setting.log_channel_id = channel.id;
				await botInteraction.reply(`Set the log channel to <#${channel.id}>!`);
				break;
			case 5:
				setting.update_channel_id = channel.id;
				await botInteraction.reply(`Set the update channel to <#${channel.id}>!`);
				break;
		}
	} else {
		let role = botInteraction.base instanceof ChatInputCommandInteraction ? botInteraction.base.options.getRole("role", true) : botInteraction.guild.roles.cache.get((botInteraction.base.content.split(" ")[1] || "").replace(/<@&|>/g, "") || "");
		if (!role) {
			await botInteraction.reply("Invalid role!");
			return;
		}
		switch (index) {
			case 6:
				if (setting.mod_roles.includes(role.id)) {
					await botInteraction.reply("That role is already in the whitelist!");
					return;
				}
				setting.mod_roles.push(role.id);
				await botInteraction.reply(`Added <@&${role.id}> to the whitelist!`);
				break;
			case 7:
				if (!setting.mod_roles.includes(role.id)) {
					await botInteraction.reply("That role isn't in the whitelist!");
					return;
				}
				setting.mod_roles.splice(setting.mod_roles.indexOf(role.id), 1);
				await botInteraction.reply(`Removed <@&${role.id}> from the whitelist!`);
				break;
			case 8:
				const roleId = role.id;
				if (setting.rewards.some((r) => r.role_id === roleId)) {
					await botInteraction.reply("That role is already a reward role!");
					return;
				}
				let type = botInteraction.base instanceof ChatInputCommandInteraction ? botInteraction.base.options.getInteger("type", true) : botInteraction.base.content.split(" ")[2] || "";
				if (type === 0) type = "points";
				else if (type === 1) type = "wins";
				if (type !== "points" && type !== "wins") {
					await botInteraction.reply("Invalid type! Must be `points` or `wins`!");
					return;
				}
				const amount = botInteraction.base instanceof ChatInputCommandInteraction ? botInteraction.base.options.getInteger("amount", true) : parseInt(botInteraction.base.content.split(" ")[3] || "");
				if (isNaN(amount) || amount < 1) {
					await botInteraction.reply("Invalid amount!");
					return;
				}
				setting.rewards.push({
					role_id: roleId,
					type: type,
					count: amount
				});
				await botInteraction.reply(`Added <@&${roleId}> as a reward role!`);
				rewards.loadRewards(setting);
				break;
			case 9:
				const roleId2 = role.id;
				if (!setting.rewards.some((r) => r.role_id === roleId2)) {
					await botInteraction.reply("That role isn't a reward role!");
					return;
				}
				setting.rewards.splice(setting.rewards.findIndex((r) => r.role_id === roleId2), 1);
				await botInteraction.reply(`Removed <@&${roleId2}> as a reward role!`);
				rewards.loadRewards(setting);
				break;
		}
	}
	setServerSetting(setting);
}