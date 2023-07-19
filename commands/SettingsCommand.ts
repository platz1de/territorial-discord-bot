import {ChatInputCommandInteraction, Colors, EmbedBuilder, Message, NewsChannel, PermissionFlagsBits, SlashCommandBuilder, TextChannel} from "discord.js";
import {setServerSetting} from "../BotSettingProvider";
import {rewards} from "../PointManager";
import {BotUserContext} from "../util/BotUserContext";

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
	execute: async (context: BotUserContext) => {
		const interaction = context.base as ChatInputCommandInteraction;
		const sub = interaction.options.getSubcommand();
		const index = settingNames.indexOf(sub);
		if (index === -1) {
			await showSettingsEmbed(context);
			return;
		}
		await handleSetting(context, index);
	},
	executeStringy: async (context: BotUserContext) => {
		if (!context.member?.permissions.has(PermissionFlagsBits.ManageRoles)) {
			await context.reply("You don't have permission to do that!");
			return;
		}
		const message = context.base as Message;
		const settingName = message.content.split(" ")[0].toLowerCase().substring(context.context.prefix.length);
		const index = settingNames.indexOf(settingName);
		if (index === -1) {
			await showSettingsEmbed(context);
			return;
		}
		await handleSetting(context, index);
	}
}

async function showSettingsEmbed(context: BotUserContext) {
	const prefix = context.context.prefix;
	context.reply({
		embeds: [
			new EmbedBuilder().setAuthor({name: context.guild.name, iconURL: context.guild.iconURL() || undefined})
				.setTitle("Server Settings")
				.addFields([
					{
						name: "❗ Prefix",
						value: `\`${prefix}\`\nUse \`${prefix}setprefix <prefix>\` to change`, inline: true
					},
					{
						name: "🏷️ Roles",
						value: `\`${context.context.roles}\` (${context.context.roles === "all" ? "Keep all roles a member has unlocked" : "Only the highest role a member unlocked"})\nUse \`${prefix}toggleroles\` to toggle`, inline: true
					},
					{
						name: "👑 Win Channels",
						value: context.context.channel_id.map((id) => `<#${id}>`).join("\n") + `\nUse \`${prefix}removechannel <id>\` or \`${prefix}addchannel <id>\` to manage`, inline: true
					},
					{
						name: "📜 Log Channel",
						value: `<#${context.context.log_channel_id}>\nUse \`${prefix}setlogchannel <id>\` to change`, inline: true
					},
					{
						name: "📰 Update Channel",
						value: `<#${context.context.update_channel_id}>\nUse \`${prefix}setupdatechannel <id>\` to change`, inline: true
					},
					{
						name: "🛠 Mod Roles",
						value: context.context.mod_roles.map((id) => `<@&${id}>`).join("\n") + `\nUse \`${prefix}removemodrole <id>\` or \`${prefix}addmodrole <id>\` to manage`, inline: true
					},
					{
						name: "🏆 Reward Roles",
						value: `See all currect reward roles using \`${prefix}roles\`\nUse \`${prefix}removerewardrole <id>\` or \`${prefix}addrewardrole <id> <points|wins> <amount>\` to manage`, inline: true
					}
				])
				.setColor(Colors.Blurple).setFooter({
				text: "All settings can also be changed using /settings",
			}).setTimestamp().toJSON()
		]
	}).catch(console.error)
}

async function handleSetting(context: BotUserContext, index: number) {
	if (!context.base) return;
	if (index === 0) {
		const prefix = context.base instanceof ChatInputCommandInteraction ? context.base.options.getString("prefix", true) : context.base.content.split(" ")[1] || "";
		if (prefix.length >= 10) {
			await context.reply("Prefix must be less than 10 characters!");
			return;
		}
		context.context.prefix = prefix;
		await context.reply(`Set prefix to \`${prefix}\``);
	} else if (index === 1) {
		context.context.roles = context.context.roles === "all" ? "highest" : "all";
		await context.reply(`Set roles to \`${context.context.roles}\``);
	} else if (index <= 5) {
		let channel = context.base instanceof ChatInputCommandInteraction ? context.base.options.getChannel("channel", true) : context.guild.channels.cache.get((context.base.content.split(" ")[1] || "").replace(/<#|>/g, "") || "");
		if (!(channel instanceof TextChannel || channel instanceof NewsChannel)) {
			await context.reply("Invalid channel!");
			return;
		}
		switch (index) {
			case 2:
				if (context.context.channel_id.includes(channel.id)) {
					await context.reply("That channel is already in the whitelist!");
					return;
				}
				context.context.channel_id.push(channel.id);
				await context.reply(`Added <#${channel.id}> to the whitelist!`);
				break;
			case 3:
				if (!context.context.channel_id.includes(channel.id)) {
					await context.reply("That channel isn't in the whitelist!");
					return;
				}
				context.context.channel_id.splice(context.context.channel_id.indexOf(channel.id), 1);
				await context.reply(`Removed <#${channel.id}> from the whitelist!`);
				break;
			case 4:
				context.context.log_channel_id = channel.id;
				await context.reply(`Set the log channel to <#${channel.id}>!`);
				break;
			case 5:
				context.context.update_channel_id = channel.id;
				await context.reply(`Set the update channel to <#${channel.id}>!`);
				break;
		}
	} else {
		let role = context.base instanceof ChatInputCommandInteraction ? context.base.options.getRole("role", true) : context.guild.roles.cache.get((context.base.content.split(" ")[1] || "").replace(/<@&|>/g, "") || "");
		if (!role) {
			await context.reply("Invalid role!");
			return;
		}
		switch (index) {
			case 6:
				if (context.context.mod_roles.includes(role.id)) {
					await context.reply("That role is already in the whitelist!");
					return;
				}
				context.context.mod_roles.push(role.id);
				await context.reply(`Added <@&${role.id}> to the whitelist!`);
				break;
			case 7:
				if (!context.context.mod_roles.includes(role.id)) {
					await context.reply("That role isn't in the whitelist!");
					return;
				}
				context.context.mod_roles.splice(context.context.mod_roles.indexOf(role.id), 1);
				await context.reply(`Removed <@&${role.id}> from the whitelist!`);
				break;
			case 8:
				const roleId = role.id;
				if (context.context.rewards.some((r) => r.role_id === roleId)) {
					await context.reply("That role is already a reward role!");
					return;
				}
				let type = context.base instanceof ChatInputCommandInteraction ? context.base.options.getInteger("type", true) : context.base.content.split(" ")[2] || "";
				if (type === 0) type = "points";
				else if (type === 1) type = "wins";
				if (type !== "points" && type !== "wins") {
					await context.reply("Invalid type! Must be `points` or `wins`!");
					return;
				}
				const amount = context.base instanceof ChatInputCommandInteraction ? context.base.options.getInteger("amount", true) : parseInt(context.base.content.split(" ")[3] || "");
				if (isNaN(amount) || amount < 1) {
					await context.reply("Invalid amount!");
					return;
				}
				context.context.rewards.push({
					role_id: roleId,
					type: type,
					count: amount
				});
				await context.reply(`Added <@&${roleId}> as a reward role!`);
				rewards.loadRewards(context.context);
				break;
			case 9:
				const roleId2 = role.id;
				if (!context.context.rewards.some((r) => r.role_id === roleId2)) {
					await context.reply("That role isn't a reward role!");
					return;
				}
				context.context.rewards.splice(context.context.rewards.findIndex((r) => r.role_id === roleId2), 1);
				await context.reply(`Removed <@&${roleId2}> as a reward role!`);
				rewards.loadRewards(context.context);
				break;
		}
	}
	setServerSetting(context.context);
}