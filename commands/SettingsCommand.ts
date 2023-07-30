import {ChatInputCommandInteraction, Colors, EmbedBuilder, Message, NewsChannel, PermissionFlagsBits, SlashCommandBuilder, TextChannel} from "discord.js";
import {setServerSetting} from "../BotSettingProvider";
import {client, rewards} from "../PointManager";
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
		if (!context.member?.permissions.has(PermissionFlagsBits.Administrator)) {
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
	let changes = [];
	for (const id of context.context.channel_id) {
		const channel = context.guild.channels.cache.get(id);
		if (!channel || !(channel instanceof TextChannel || channel instanceof NewsChannel)) {
			changes.push(`Removed invalid channel ${id} from the win channels`);
			context.context.channel_id.splice(context.context.channel_id.indexOf(id), 1);
		} else {
			if (channel.permissionsFor(client.user!)?.has(PermissionFlagsBits.ReadMessageHistory) !== true || channel.permissionsFor(client.user!)?.has(PermissionFlagsBits.ViewChannel) !== true) {
				changes.push(`I don't have permission to read messages in ${channel}`);
			}
			if (channel.permissionsFor(client.user!)?.has(PermissionFlagsBits.SendMessages) !== true || channel.permissionsFor(client.user!)?.has(PermissionFlagsBits.ViewChannel) !== true) {
				changes.push(`I don't have permission to send messages in <#${channel}`);
			}
		}
	}
	const logChannel = context.guild.channels.cache.get(context.context.log_channel_id);
	if (!logChannel || !(logChannel instanceof TextChannel || logChannel instanceof NewsChannel)) {
		changes.push(`Invalid log channel ${logChannel}`);
	} else {
		if (logChannel.permissionsFor(client.user!)?.has(PermissionFlagsBits.SendMessages) !== true || logChannel.permissionsFor(client.user!)?.has(PermissionFlagsBits.ViewChannel) !== true) {
			changes.push(`I don't have permission to send messages in ${logChannel}`);
		}
	}
	const updateChannel = context.guild.channels.cache.get(context.context.update_channel_id);
	if (!updateChannel || !(updateChannel instanceof TextChannel || updateChannel instanceof NewsChannel)) {
		changes.push(`Invalid update channel ${updateChannel}`);
	} else {
		if (updateChannel.permissionsFor(client.user!)?.has(PermissionFlagsBits.SendMessages) !== true || updateChannel.permissionsFor(client.user!)?.has(PermissionFlagsBits.ViewChannel) !== true) {
			changes.push(`I don't have permission to send messages in ${updateChannel}`);
		}
	}
	for (const role of context.context.mod_roles) {
		if (!context.guild.roles.cache.has(role)) {
			changes.push(`Removed invalid role ${role} from the mod roles`);
			context.context.mod_roles.splice(context.context.mod_roles.indexOf(role), 1);
		}
	}
	if (context.context.rewards.length !== 0) {
		if (!context.guild.members.cache.get(client.user!.id)?.permissions.has(PermissionFlagsBits.ManageRoles)) {
			changes.push("I don't have permission to manage roles");
		}
	}
	for (const role of context.context.rewards) {
		if (!context.guild.roles.cache.has(role.role_id)) {
			changes.push(`Removed invalid role ${role.role_id} from the reward roles`);
			context.context.rewards.splice(context.context.rewards.indexOf(role), 1);
		} else if (context.guild.roles.cache.get(role.role_id)?.editable !== true) {
			changes.push(`I don't have permission to give out <@&${role.role_id}>`);
		}
	}
	let embeds = [];
	if (changes.length > 0) {
		embeds.push(new EmbedBuilder().setTitle("Warning").setDescription(changes.join("\n")).setColor(Colors.Yellow).toJSON());
	}
	embeds.push(new EmbedBuilder().setAuthor({name: context.guild.name, iconURL: context.guild.iconURL() || undefined})
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
		}).setTimestamp().toJSON());
	context.reply({embeds}).catch(console.error)
}

async function handleSetting(context: BotUserContext, index: number) {
	if (!context.base || !context.member) return;
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
				if (context.member.roles.highest.position <= role.position && context.member.id !== context.guild.ownerId) {
					await context.reply("You can't add a role higher than your highest role!");
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