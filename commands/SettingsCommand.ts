import {ActionRowBuilder, ButtonBuilder, ButtonInteraction, ButtonStyle, ChatInputCommandInteraction, Colors, EmbedBuilder, NewsChannel, PermissionFlagsBits, SlashCommandBuilder, Snowflake, TextChannel} from "discord.js";
import {ServerSetting, setServerSetting} from "../BotSettingProvider";
import {client, config, getCommandId, rewards} from "../PointManager";
import {BotUserContext} from "../util/BotUserContext";
import {getEndpointStatus} from "../util/TTHQ";
import {getOrSendMessage} from "../util/ClaimWinChannel";

export default {
	slashData: new SlashCommandBuilder().setName("settings").setDescription("Change server settings")
		.addSubcommand(sub => sub.setName("toggleroles").setDescription("Toggle the roles menu"))
		.addSubcommand(sub => sub.setName("toggleautopoints").setDescription("Toggle the auto points system"))
		.addSubcommand(sub => sub.setName("addchannel").setDescription("Add a channel to the channel whitelist").addChannelOption(option => option.setName("channel").setDescription("The channel to add").setRequired(true)))
		.addSubcommand(sub => sub.setName("removechannel").setDescription("Remove a channel from the channel whitelist").addChannelOption(option => option.setName("channel").setDescription("The channel to remove").setRequired(true)))
		.addSubcommand(sub => sub.setName("setlogchannel").setDescription("Set the log channel").addChannelOption(option => option.setName("channel").setDescription("The channel to set").setRequired(true)))
		.addSubcommand(sub => sub.setName("setupdatechannel").setDescription("Set the update channel").addChannelOption(option => option.setName("channel").setDescription("The channel to set").setRequired(true)))
		.addSubcommand(sub => sub.setName("addmodrole").setDescription("Add a role to the mod roles").addRoleOption(option => option.setName("role").setDescription("The role to add").setRequired(true)))
		.addSubcommand(sub => sub.setName("removemodrole").setDescription("Remove a role from the mod roles").addRoleOption(option => option.setName("role").setDescription("The role to remove").setRequired(true)))
		.addSubcommand(sub => sub.setName("addrewardrole").setDescription("Add a role to the reward roles").addRoleOption(option => option.setName("role").setDescription("The role to add").setRequired(true)).addIntegerOption(option => option.setName("type").setDescription("The type of reward").setRequired(true).addChoices({name: "Points", value: 0}, {name: "Wins", value: 1})).addIntegerOption(option => option.setName("amount").setDescription("The amount of points or wins required").setRequired(true)))
		.addSubcommand(sub => sub.setName("removerewardrole").setDescription("Remove a role from the reward roles").addRoleOption(option => option.setName("role").setDescription("The role to remove").setRequired(true)))
		.addSubcommand(sub => sub.setName("setwinfeed").setDescription("Set the win feed channel").addChannelOption(option => option.setName("channel").setDescription("The channel to set").setRequired(true)))
		.addSubcommand(sub => sub.setName("removewinfeed").setDescription("Remove the win feed channel"))
		.addSubcommand(sub => sub.setName("setclaimchannel").setDescription("Set the claim channel").addChannelOption(option => option.setName("channel").setDescription("The channel to set").setRequired(true)))
		.addSubcommand(sub => sub.setName("removeclaimchannel").setDescription("Remove the claim channel"))
		.addSubcommand(sub => sub.setName("setclaimchanneldescription").setDescription("Set the claim channel description").addStringOption(option => option.setName("description").setDescription("The description to set").setRequired(true)))
		.addSubcommand(sub => sub.setName("show").setDescription("Show the current settings"))
		.setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
	execute: async (context: BotUserContext) => {
		const interaction = context.base as ChatInputCommandInteraction;
		const sub = interaction.options.getSubcommand();
		if (sub === "show") {
			await showSettingsEmbed(context, 0);
			return;
		}
		await handleSetting(interaction, context, sub);
	}
}

async function showSettingsEmbed(context: BotUserContext, page: number) {
	let changes = [], isCritical = false;
	if (context.context.auto_points || context.context.win_feed || context.context.claim_channel) {
		let status = getEndpointStatus(context.guild.id, true);
		if (!status.success) {
			changes.push(status.message + `\nUse </endpoint:${getCommandId("endpoint")}> for instructions on how to fix this!`);
			isCritical = true;
		}
	}
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
	if (context.context.win_feed) {
		const channel = context.guild.channels.cache.get(context.context.win_feed);
		if (!channel || !(channel instanceof TextChannel || channel instanceof NewsChannel)) {
			changes.push(`Invalid win feed ${channel}`);
		} else {
			if (channel.permissionsFor(client.user!)?.has(PermissionFlagsBits.SendMessages) !== true || channel.permissionsFor(client.user!)?.has(PermissionFlagsBits.ViewChannel) !== true) {
				changes.push(`I don't have permission to send messages in ${channel}`);
			}
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
			rewards.loadRewards(context.context);
		} else if (context.guild.roles.cache.get(role.role_id)?.editable !== true) {
			changes.push(`I don't have permission to give out <@&${role.role_id}>`);
		}
	}
	let embeds = [];
	if (changes.length > 0) {
		embeds.push(new EmbedBuilder().setTitle("Warning").setDescription(changes.join("\n")).setColor(isCritical ? Colors.Red : Colors.Yellow).toJSON());
	}
	embeds.push(new EmbedBuilder().setAuthor({name: context.guild.name, iconURL: context.guild.iconURL() || undefined})
		.setTitle(["Point Management Settings", "Role Settings", "Channel Settings"][page])
		.addFields(getSettingsFields(context.context, page))
		.setColor(Colors.Blurple).setFooter({
			text: "Use buttons below to navigate"
		}).setTimestamp().toJSON());
	let msg = await context.reply({
		embeds,
		components: [
			new ActionRowBuilder<ButtonBuilder>().addComponents(
				new ButtonBuilder().setCustomId("settings:p").setLabel("Points").setStyle(page === 0 ? ButtonStyle.Primary : ButtonStyle.Secondary),
				new ButtonBuilder().setCustomId("settings:r").setLabel("Roles").setStyle(page === 1 ? ButtonStyle.Primary : ButtonStyle.Secondary),
				new ButtonBuilder().setCustomId("settings:c").setLabel("Channels").setStyle(page === 2 ? ButtonStyle.Primary : ButtonStyle.Secondary)
			)
		]
	});

	if (!context.channel) return;
	const collector = context.channel.createMessageComponentCollector({time: 120000});
	collector.on("collect", async i => {
		if (!(i instanceof ButtonInteraction) || i.message.id !== msg.id || i.user.id !== context.user.id) return;
		await i.deferUpdate();
		collector.stop();
		await showSettingsEmbed(context, ["settings:p", "settings:r", "settings:c"].indexOf(i.customId));
	});

	collector.on("end", async (collected, reason) => {
		try {
			reason === "time" && await msg.edit({components: []})
		} catch (e) {
		}
	});
}

function getSettingsFields(context: ServerSetting, page: number): { name: string, value: string }[] {
	switch (page) {
		case 0:
			return [
				{
					name: "♻ Automatic Point Management",
					value: (context.auto_points ? "Enabled" : "Disabled") + `\nAllows to automatically add points when members with them using [BetterTT](https://platz1de.github.io/BetterTT/).\n\nMake sure to follow the setup guide: </endpoint:${getCommandId("endpoint")}>\nEdit: </settings toggleautopoints:${getCommandId("settings")}>`
				},
				{
					name: "🔢 Multiplier",
					value: (context.multiplier ? `\`x ${context.multiplier.amount}\`` : "Inactive") + `\nPoints are multiplied by this amount when added to a member's balance.\nEdit: </multiplier set:${getCommandId("multiplier")}> & </multiplier clear:${getCommandId("multiplier")}>`
				},
				{
					name: "📝 Win Feed",
					value: (context.win_feed ? `<#${context.win_feed}>` : "Inactive") + `\nPosts a message in this channel when your clan wins a game. Allows members to claim points.\nEdit: </settings setwinfeed:${getCommandId("settings")}> & </settings removewinfeed:${getCommandId("settings")}>`
				},
				{
					name: "📑 Claim Channel",
					value: (context.claim_channel ? `<#${context.claim_channel}>` : "Inactive") + `\nDescription: ${context.claim_channel_description}\nAllows members to claim points for games they won by selecting a recent game.\nEdit: </settings setclaimchannel:${getCommandId("settings")}> & </settings removeclaimchannel:${getCommandId("settings")}> & </settings setclaimchanneldescription:${getCommandId("settings")}>`
				}
			];
		case 1:
			return [
				{
					name: "👑 Win Channels",
					value: context.channel_id.map((id) => `<#${id}>`).join("\n") + `\nWin add commands are only accepted in these channels to keep your server clean.\nEdit </settings removechannel:${getCommandId("settings")}> & </settings addchannel:${getCommandId("settings")}>`
				},
				{
					name: "📜 Log Channel",
					value: `<#${context.log_channel_id}>\nAll moderation or potentially dangerous actions are logged here.\nEdit: </settings setlogchannel:${getCommandId("settings")}>`
				},
				{
					name: "📰 Update Channel",
					value: `<#${context.update_channel_id}>\nImportant messages about the bot get posted here. (Only very rarely used)\nEdit: </settings setupdatechannel:${getCommandId("settings")}>`
				},
				{
					name: "📋 Clan Feed",
					value: `${context.webhooks.length} feeds\nFeeds allow you to get yours or all clan wins posted in a channel.\nEdit: </subscribefeed:${getCommandId("subscribefeed")}> & </unsubscribefeed:${getCommandId("unsubscribefeed")}>`
				}
			];
		case 2:
			return [
				{
					name: "🛠 Mod Roles",
					value: context.mod_roles.map((id) => `<@&${id}>`).join("\n") + `\nThese roles can use moderation commands and manage points of other members.\nEdit: </settings removemodrole:${getCommandId("settings")}> & </settings addmodrole:${getCommandId("settings")}>`
				},
				{
					name: "🏷️ Roles",
					value: `\`${context.roles}\` (${context.roles === "all" ? "Keep all roles a member has unlocked" : "Only the highest role a member unlocked"})\nGeneral behaviour of reward roles.\nEdit: </settings toggleroles:${getCommandId("settings")}>`
				},
				{
					name: "🏆 Reward Roles",
					value: `See all currect reward roles using </roles:${getCommandId("roles")}>\nReward roles are given once certain configurable milestones are reached.\nEdit </settings removerewardrole:${getCommandId("settings")}> & </settings addrewardrole:${getCommandId("settings")}>`
				}
			];
		default:
			return [];
	}
}

async function handleSetting(data: ChatInputCommandInteraction, context: BotUserContext, index: string) {
	if (!context.base || !context.member) return;
	if (index === "toggleroles") {
		context.context.roles = context.context.roles === "all" ? "highest" : "all";
		await context.reply(`Set roles to \`${context.context.roles}\``);
	} else if (index === "toggleautopoints") {
		context.context.auto_points = !context.context.auto_points;
		if (context.context.auto_points) {
			await context.reply(`Enabled automatic point management!\nMembers will automatically earn points here when playing on a compatible client.\nUse </endpoint:${getCommandId("endpoint")}> to setup the endpoint, which is required for this to function!`);
		} else {
			await context.reply("Disabled automatic point management!");
		}
	} else if (index === "removewinfeed") {
		context.context.win_feed = null;
		await context.reply("Removed the win feed!");
	} else if (index === "removeclaimchannel") {
		context.context.claim_channel = null;
		await context.reply("Removed the claim channel!");
	} else if (index === "setclaimchanneldescription") {
		const description = data.options.getString("description", true);
		context.context.claim_channel_description = description;
		await context.reply(`Set the claim channel description to ${description}!`);
		await getOrSendMessage(context.context);
	} else if (["addchannel", "removechannel", "setlogchannel", "setupdatechannel", "setwinfeed", "setclaimchannel"].includes(index)) {
		let channel = data.options.getChannel("channel", true);
		if (!(channel instanceof TextChannel || channel instanceof NewsChannel)) {
			await context.reply("Invalid channel!");
			return;
		}
		switch (index) {
			case "addchannel":
				if (context.context.channel_id.includes(channel.id)) {
					await context.reply("That channel is already in the whitelist!");
					return;
				}
				context.context.channel_id.push(channel.id);
				await context.reply(`Added <#${channel.id}> to the whitelist!`);
				break;
			case "removechannel":
				if (!context.context.channel_id.includes(channel.id)) {
					await context.reply("That channel isn't in the whitelist!");
					return;
				}
				context.context.channel_id.splice(context.context.channel_id.indexOf(channel.id), 1);
				await context.reply(`Removed <#${channel.id}> from the whitelist!`);
				break;
			case "setlogchannel":
				context.context.log_channel_id = channel.id;
				await context.reply(`Set the log channel to <#${channel.id}>!`);
				break;
			case "setupdatechannel":
				context.context.update_channel_id = channel.id;
				await context.reply(`Set the update channel to <#${channel.id}>!`);
				break;
			case "setwinfeed":
				context.context.win_feed = channel.id;
				await context.reply(`Set the win feed to <#${channel.id}>!`);
				break;
			case "setclaimchannel":
				context.context.claim_channel = channel.id;
				await context.reply(`Set the claim channel to <#${channel.id}>!`);
				await getOrSendMessage(context.context);
				break;
		}
	} else {
		let role = data.options.getRole("role", true);
		if (!role) {
			await context.reply("Invalid role!");
			return;
		}
		switch (index) {
			case "addmodrole":
				if (context.context.mod_roles.includes(role.id)) {
					await context.reply("That role is already in the whitelist!");
					return;
				}
				context.context.mod_roles.push(role.id);
				await context.reply(`Added <@&${role.id}> to the whitelist!`);
				break;
			case "removemodrole":
				if (!context.context.mod_roles.includes(role.id)) {
					await context.reply("That role isn't in the whitelist!");
					return;
				}
				context.context.mod_roles.splice(context.context.mod_roles.indexOf(role.id), 1);
				await context.reply(`Removed <@&${role.id}> from the whitelist!`);
				break;
			case "addrewardrole":
				const roleId = role.id;
				if (context.context.rewards.some((r) => r.role_id === roleId)) {
					await context.reply("That role is already a reward role!");
					return;
				}
				if (context.member.roles.highest.position <= role.position && context.member.id !== context.guild.ownerId) {
					await context.reply("You can't add a role higher than your highest role!");
					return;
				}
				let type = data.options.getInteger("type", true);
				const amount = data.options.getInteger("amount", true);
				if (isNaN(amount) || amount < 1) {
					await context.reply("Invalid amount!");
					return;
				}
				context.context.rewards.push({
					role_id: roleId,
					type: type === 0 ? "points" : "wins",
					count: amount
				});
				await context.reply(`Added <@&${roleId}> as a reward role for ${amount} ${type}!`);
				rewards.loadRewards(context.context);
				break;
			case "removerewardrole":
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