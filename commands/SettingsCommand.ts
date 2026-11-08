import {ActionRowBuilder, ButtonBuilder, ButtonInteraction, ButtonStyle, ChatInputCommandInteraction, Colors, EmbedBuilder, GuildMember, NewsChannel, PermissionFlagsBits, SlashCommandBuilder, TextChannel} from "discord.js";
import {updateClanTag, updateSettings} from "../BotSettingProvider.js";
import {client, getCommandId, PointCommand, rewards} from "../PointManager.js";
import {BotUserContext, LimitedServerSettings} from "../util/BotUserContext.js";
import {getOrSendMessage} from "../util/ClaimWinChannel.js";

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
		.addSubcommand(sub => sub.setName("addfactor").setDescription("Add or remove a factor button").addStringOption(option => option.setName("name").setDescription("The name of the button").setRequired(true)).addIntegerOption(option => option.setName("factor").setDescription("The factor of the button (in percent)").setRequired(true)))
		.addSubcommand(sub => sub.setName("removefactor").setDescription("Remove a factor button").addStringOption(option => option.setName("name").setDescription("The name of the button").setRequired(true)))
		.addSubcommand(sub => sub.setName("settag").setDescription("Set the clan tag").addStringOption(option => option.setName("tag").setDescription("The tag to set").setRequired(true)))
		.addSubcommand(sub => sub.setName("show").setDescription("Show the current settings"))
		.setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
	execute: async (context: BotUserContext) => {
		const interaction = context.base as ChatInputCommandInteraction;
		const sub = interaction.options.getSubcommand();
		if (sub === "show") {
			await showSettingsEmbed(context, 0);
			return;
		}
		await handleSetting(interaction, context.getSettings(), sub);
	}
} as PointCommand;

async function showSettingsEmbed(context: BotUserContext, page: number) {
	const interaction = context.base as ChatInputCommandInteraction;
	let changes = [], isCritical = false;
	if (context.getSettings().auto_points || context.getSettings().win_feed || context.getSettings().claim_channel) {
		if (!context.getSettings().tag) {
			changes.push(`This server doesn't have a clan tag set! Use </settings settag:${getCommandId("settings")}> to set it!`);
			isCritical = true;
		}
	}
	for (const id of context.getSettings().channel_id) {
		const channel = context.guild.channels.cache.get(id);
		if (!channel || !(channel instanceof TextChannel || channel instanceof NewsChannel)) {
			changes.push(`Removed invalid channel ${id} from the win channels`);
			context.getSettings().channel_id.splice(context.getSettings().channel_id.indexOf(id), 1);
		} else {
			if (channel.permissionsFor(client.user!)?.has(PermissionFlagsBits.ReadMessageHistory) !== true || channel.permissionsFor(client.user!)?.has(PermissionFlagsBits.ViewChannel) !== true) {
				changes.push(`I don't have permission to read messages in ${channel}`);
			}
			if (channel.permissionsFor(client.user!)?.has(PermissionFlagsBits.SendMessages) !== true || channel.permissionsFor(client.user!)?.has(PermissionFlagsBits.ViewChannel) !== true) {
				changes.push(`I don't have permission to send messages in <#${channel}`);
			}
		}
	}
	const logChannel = context.guild.channels.cache.get(context.getSettings().log_channel_id);
	if (!logChannel || !(logChannel instanceof TextChannel || logChannel instanceof NewsChannel)) {
		changes.push(`Invalid log channel ${logChannel}`);
	} else {
		if (logChannel.permissionsFor(client.user!)?.has(PermissionFlagsBits.SendMessages) !== true || logChannel.permissionsFor(client.user!)?.has(PermissionFlagsBits.ViewChannel) !== true) {
			changes.push(`I don't have permission to send messages in ${logChannel}`);
		}
	}
	const updateChannel = context.guild.channels.cache.get(context.getSettings().update_channel_id);
	if (!updateChannel || !(updateChannel instanceof TextChannel || updateChannel instanceof NewsChannel)) {
		changes.push(`Invalid update channel ${updateChannel}`);
	} else {
		if (updateChannel.permissionsFor(client.user!)?.has(PermissionFlagsBits.SendMessages) !== true || updateChannel.permissionsFor(client.user!)?.has(PermissionFlagsBits.ViewChannel) !== true) {
			changes.push(`I don't have permission to send messages in ${updateChannel}`);
		}
	}
	const winFeed = context.getSettings().win_feed;
	if (winFeed) {
		const channel = context.guild.channels.cache.get(winFeed);
		if (!channel || !(channel instanceof TextChannel || channel instanceof NewsChannel)) {
			changes.push(`Invalid win feed ${channel}`);
		} else {
			if (channel.permissionsFor(client.user!)?.has(PermissionFlagsBits.SendMessages) !== true || channel.permissionsFor(client.user!)?.has(PermissionFlagsBits.ViewChannel) !== true) {
				changes.push(`I don't have permission to send messages in ${channel}`);
			}
		}
	}
	for (const role of context.getSettings().mod_roles) {
		if (!context.guild.roles.cache.has(role)) {
			changes.push(`Removed invalid role ${role} from the mod roles`);
			context.getSettings().mod_roles.splice(context.getSettings().mod_roles.indexOf(role), 1);
		}
	}
	if (context.getSettings().rewards.length !== 0) {
		if (!context.guild.members.cache.get(client.user!.id)?.permissions.has(PermissionFlagsBits.ManageRoles)) {
			changes.push("I don't have permission to manage roles");
		}
	}
	for (const role of context.getSettings().rewards) {
		if (!context.guild.roles.cache.has(role.role_id)) {
			changes.push(`Removed invalid role ${role.role_id} from the reward roles`);
			context.getSettings().rewards.splice(context.getSettings().rewards.indexOf(role), 1);
			rewards.loadRewards(context.getSettings());
		} else if (context.guild.roles.cache.get(role.role_id)?.editable !== true) {
			changes.push(`I don't have permission to give out <@&${role.role_id}>`);
		}
	}
	let embeds = [];
	if (changes.length > 0) {
		embeds.push(new EmbedBuilder().setTitle("Warning").setDescription(changes.join("\n")).setColor(isCritical ? Colors.Red : Colors.Yellow).toJSON());
	}
	embeds.push(new EmbedBuilder().setAuthor({name: context.guild.name, iconURL: context.guild.iconURL() || undefined})
		.setTitle(["Point Management Settings", "Win Claiming Settings", "Channel Settings", "Role Settings"][page])
		.addFields(getSettingsFields(context, page))
		.setColor(Colors.Blurple).setFooter({
			text: "Use buttons below to navigate"
		}).setTimestamp().toJSON());
	let msg = await interaction.editReply({
		embeds,
		components: [
			new ActionRowBuilder<ButtonBuilder>().addComponents(
				new ButtonBuilder().setCustomId("settings:p").setLabel("Points").setStyle(page === 0 ? ButtonStyle.Primary : ButtonStyle.Secondary),
				new ButtonBuilder().setCustomId("settings:w").setLabel("Win Claiming").setStyle(page === 1 ? ButtonStyle.Primary : ButtonStyle.Secondary),
				new ButtonBuilder().setCustomId("settings:c").setLabel("Channels").setStyle(page === 2 ? ButtonStyle.Primary : ButtonStyle.Secondary),
				new ButtonBuilder().setCustomId("settings:r").setLabel("Roles").setStyle(page === 3 ? ButtonStyle.Primary : ButtonStyle.Secondary)
			)
		]
	});

	if (!context.channel) return;
	const collector = context.channel.createMessageComponentCollector({time: 120000});
	collector.on("collect", async i => {
		if (!(i instanceof ButtonInteraction) || i.message.id !== msg.id || i.user.id !== context.user.id) return;
		await i.deferUpdate();
		collector.stop();
		await showSettingsEmbed(context, ["settings:p", "settings:w", "settings:c", "settings:r"].indexOf(i.customId));
	});

	collector.on("end", async (collected, reason) => {
		try {
			reason === "time" && await msg.edit({components: []})
		} catch (e) {
		}
	});
}

function getSettingsFields(context: BotUserContext, page: number): { name: string, value: string }[] {
	const settings = context.getSettings();
	switch (page) {
		case 0:
			const multiplier = context.getActiveMultiplier();
			return [
				{
					name: "🏷️ Clan Tag",
					value: `\`${settings.tag || "None"}\`\nSet this to enable the full feature set.\nEdit: </settings settag:${getCommandId("settings")}>`
				},
				{
					name: "♻ Automatic Point Management",
					value: (settings.auto_points ? "Enabled" : "Disabled") + `\nAllows to automatically add points when members with them using [BetterTT](https://platz1de.github.io/BetterTT/).\n\nMake sure to follow the setup guide: </endpoint:${getCommandId("endpoint")}>\nEdit: </settings toggleautopoints:${getCommandId("settings")}>`
				},
				{
					name: "🔢 Multiplier",
					value: (multiplier ? `\`x ${multiplier.amount}\`` : "Inactive") + `\nPoints are multiplied by this amount when added to a member's balance.\nEdit: </multiplier set:${getCommandId("multiplier")}> & </multiplier clear:${getCommandId("multiplier")}>`
				}
			];
		case 1:
			return [
				{
					name: "📝 Win Feed",
					value: (settings.win_feed ? `<#${settings.win_feed}>` : "Inactive") + `\nPosts a message in this channel when your clan wins a game. Allows members to claim points.\nEdit: </settings setwinfeed:${getCommandId("settings")}> & </settings removewinfeed:${getCommandId("settings")}>`
				},
				{
					name: "📑 Claim Channel",
					value: (settings.claim_channel ? `<#${settings.claim_channel}>` : "Inactive") + `\nDescription: ${settings.claim_channel_description}\nAllows members to claim points for games they won by selecting a recent game.\nEdit: </settings setclaimchannel:${getCommandId("settings")}> & </settings removeclaimchannel:${getCommandId("settings")}> & </settings setclaimchanneldescription:${getCommandId("settings")}>`
				},
				{
					name: "🔘 Factor Buttons",
					value: `${settings.factor_buttons.length === 0 ? "None" : settings.factor_buttons.map((f) => `${f.name}: ${f.factor}\n`).join("")}\nAllows you to add multiple claiming methods for win feeds / claim channels. E.g. you can have one button for 100% and one for 50% of the points (note that the requirements your server puts aren't verified).\nEdit: </settings addfactor:${getCommandId("settings")}> & </settings removefactor:${getCommandId("settings")}>`
				}
			];
		case 2:
			return [
				{
					name: "👑 Win Channels",
					value: settings.channel_id.map((id) => `<#${id}>`).join("\n") + `\nWin add commands are only accepted in these channels to keep your server clean.\nEdit </settings removechannel:${getCommandId("settings")}> & </settings addchannel:${getCommandId("settings")}>`
				},
				{
					name: "📜 Log Channel",
					value: `<#${settings.log_channel_id}>\nAll moderation or potentially dangerous actions are logged here.\nEdit: </settings setlogchannel:${getCommandId("settings")}>`
				},
				{
					name: "📰 Update Channel",
					value: `<#${settings.update_channel_id}>\nImportant messages about the bot get posted here. (Only very rarely used)\nEdit: </settings setupdatechannel:${getCommandId("settings")}>`
				},
				{
					name: "📋 Clan Feed",
					value: `${settings.webhooks.length} feeds\nFeeds allow you to get yours or all clan wins posted in a channel.\nEdit: </subscribefeed:${getCommandId("subscribefeed")}> & </unsubscribefeed:${getCommandId("unsubscribefeed")}>`
				}
			];
		case 3:
			return [
				{
					name: "🛠 Mod Roles",
					value: settings.mod_roles.map((id) => `<@&${id}>`).join("\n") + `\nThese roles can use moderation commands and manage points of other members.\nEdit: </settings removemodrole:${getCommandId("settings")}> & </settings addmodrole:${getCommandId("settings")}>`
				},
				{
					name: "🏷️ Roles",
					value: `\`${settings.roles}\` (${settings.roles === "all" ? "Keep all roles a member has unlocked" : "Only the highest role a member unlocked"})\nGeneral behaviour of reward roles.\nEdit: </settings toggleroles:${getCommandId("settings")}>`
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

async function handleSetting(data: ChatInputCommandInteraction, settings: LimitedServerSettings, index: string) {
	const member = data.member;
	if (!(member instanceof GuildMember)) return;
	if (index === "toggleroles") {
		settings.roles = settings.roles === "all" ? "highest" : "all";
		await data.editReply(`Set roles to \`${settings.roles}\``);
	} else if (index === "toggleautopoints") {
		settings.auto_points = !settings.auto_points;
		if (settings.auto_points) {
			await data.editReply(`Enabled automatic point management!\nMembers will automatically earn points here when playing on a compatible client.\nUse </endpoint:${getCommandId("endpoint")}> to setup the endpoint, which is required for this to function!`);
		} else {
			await data.editReply("Disabled automatic point management!");
		}
	} else if (index === "removewinfeed") {
		settings.win_feed = null;
		await data.editReply("Removed the win feed!");
	} else if (index === "removeclaimchannel") {
		settings.claim_channel = null;
		await data.editReply("Removed the claim channel!");
	} else if (index === "setclaimchanneldescription") {
		const description = data.options.getString("description", true);
		settings.claim_channel_description = description;
		await data.editReply(`Set the claim channel description to ${description}!`);
		await getOrSendMessage(settings);
	} else if (index === "addfactor") {
		const name = data.options.getString("name", true);
		const factor = data.options.getInteger("factor", true);
		if (settings.factor_buttons.some((f) => f.name === name)) {
			await data.editReply("That factor button already exists!");
			return;
		}
		if (settings.factor_buttons.length >= 5) {
			await data.editReply("You can't add more than 5 factor buttons!");
			return;
		}
		if (isNaN(factor) || factor < 1 || factor > 200) {
			await data.editReply("Invalid factor! Must be between 1 and 200!");
			return;
		}
		settings.factor_buttons.push({name, factor: factor / 100});
		await data.editReply(`Added the factor button ${name} with factor ${factor}%!`);
		await getOrSendMessage(settings);
	} else if (index === "removefactor") {
		const name = data.options.getString("name", true);
		if (!settings.factor_buttons.some((f) => f.name === name)) {
			await data.editReply("That factor button doesn't exist!");
			return;
		}
		settings.factor_buttons.splice(settings.factor_buttons.findIndex((f) => f.name === name), 1);
		await data.editReply(`Removed the factor button ${name}!`);
		await getOrSendMessage(settings);
	} else if (index === "settag") {
		const tag = data.options.getString("tag", true);
		if (tag.length > 7) {
			await data.editReply("Invalid tag! Must be 7 characters or fewer!");
			return;
		}
		updateClanTag(settings, tag === "" ? null : tag.toUpperCase());
		await data.editReply(`Set the clan tag to ${settings.tag || "None"}!`);
	} else if (["addchannel", "removechannel", "setlogchannel", "setupdatechannel", "setwinfeed", "setclaimchannel"].includes(index)) {
		let channel = data.options.getChannel("channel", true);
		if (!(channel instanceof TextChannel || channel instanceof NewsChannel)) {
			await data.editReply("Invalid channel!");
			return;
		}
		switch (index) {
			case "addchannel":
				if (settings.channel_id.includes(channel.id)) {
					await data.editReply("That channel is already in the whitelist!");
					return;
				}
				settings.channel_id.push(channel.id);
				await data.editReply(`Added <#${channel.id}> to the whitelist!`);
				break;
			case "removechannel":
				if (!settings.channel_id.includes(channel.id)) {
					await data.editReply("That channel isn't in the whitelist!");
					return;
				}
				settings.channel_id.splice(settings.channel_id.indexOf(channel.id), 1);
				await data.editReply(`Removed <#${channel.id}> from the whitelist!`);
				break;
			case "setlogchannel":
				settings.log_channel_id = channel.id;
				await data.editReply(`Set the log channel to <#${channel.id}>!`);
				break;
			case "setupdatechannel":
				settings.update_channel_id = channel.id;
				await data.editReply(`Set the update channel to <#${channel.id}>!`);
				break;
			case "setwinfeed":
				settings.win_feed = channel.id;
				await data.editReply(`Set the win feed to <#${channel.id}>!`);
				break;
			case "setclaimchannel":
				settings.claim_channel = channel.id;
				await data.editReply(`Set the claim channel to <#${channel.id}>!`);
				await getOrSendMessage(settings);
				break;
		}
	} else {
		let role = data.options.getRole("role", true);
		if (!role) {
			await data.editReply("Invalid role!");
			return;
		}
		switch (index) {
			case "addmodrole":
				if (settings.mod_roles.includes(role.id)) {
					await data.editReply("That role is already in the whitelist!");
					return;
				}
				settings.mod_roles.push(role.id);
				await data.editReply(`Added <@&${role.id}> to the whitelist!`);
				break;
			case "removemodrole":
				if (!settings.mod_roles.includes(role.id)) {
					await data.editReply("That role isn't in the whitelist!");
					return;
				}
				settings.mod_roles.splice(settings.mod_roles.indexOf(role.id), 1);
				await data.editReply(`Removed <@&${role.id}> from the whitelist!`);
				break;
			case "addrewardrole":
				const roleId = role.id;
				if (settings.rewards.some((r) => r.role_id === roleId)) {
					await data.editReply("That role is already a reward role!");
					return;
				}
				if (member.roles.highest.position <= role.position && member.id !== member.guild.ownerId) {
					await data.editReply("You can't add a role higher than your highest role!");
					return;
				}
				let type = data.options.getInteger("type", true);
				const amount = data.options.getInteger("amount", true);
				if (isNaN(amount) || amount < 1) {
					await data.editReply("Invalid amount!");
					return;
				}
				settings.rewards.push({
					role_id: roleId,
					type: type === 0 ? "points" : "wins",
					count: amount
				});
				await data.editReply(`Added <@&${roleId}> as a reward role for ${amount} ${type === 0 ? "points" : "wins"}!`);
				rewards.loadRewards(settings);
				break;
			case "removerewardrole":
				const roleId2 = role.id;
				if (!settings.rewards.some((r) => r.role_id === roleId2)) {
					await data.editReply("That role isn't a reward role!");
					return;
				}
				settings.rewards.splice(settings.rewards.findIndex((r) => r.role_id === roleId2), 1);
				await data.editReply(`Removed <@&${roleId2}> as a reward role!`);
				rewards.loadRewards(settings);
				break;
		}
	}
	updateSettings();
}