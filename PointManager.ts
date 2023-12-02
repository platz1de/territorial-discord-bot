import {Client, Collection, ColorResolvable, ContextMenuCommandBuilder, EmbedBuilder, Events, GatewayIntentBits, GuildMember, REST, Routes, SlashCommandBuilder, TextChannel, ApplicationCommandType} from "discord.js";
import rewards = require("./util/RewardManager");
import db = require("./db/DataBaseManager");
import {sendUninitializedError} from "./util/EmbedUtil";
import {handleDialog, hasDialog} from "./util/SetupDisalogUtil";
import {BotUserContext, getRawUser, getUser} from "./util/BotUserContext";
import {removeServerSetting} from "./BotSettingProvider";
import {BaseUserContext} from "./util/BaseUserContext";
import {handleMessage} from "./util/EntryMessageHandler";
import {handleFeedInteraction} from "./util/ClaimWinFeed";
import {handleChannelInteraction} from "./util/ClaimWinChannel";
import {showProfileEmbed} from "./commands/ProfileCommand";

export const config: { token: string, unbelieva_app_id: string, unbelieva_bot_token: string, endpoint_self: string, btt_api_url: string, wss_secret: string, bot_owner: string} = require("./config.json");
export const client = new Client({intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.DirectMessages]});

export interface Command {
	requiresUser: boolean,
	slashData: SlashCommandBuilder | { name: string, toJSON(): any }
	execute: (context: BaseUserContext) => Promise<void>,
}

export interface GenericCommand extends Command {
	requiresUser: false
}

// @ts-ignore
export interface PointCommand extends Command {
	requiresUser: true,
	execute: (context: BotUserContext) => Promise<void>
}

const commandRegistry = new Collection<string, Command>();
const commandIdTable: { [key: string]: string } = {};

client.once(Events.ClientReady, async () => {
	await registerCommand("PingCommand");
	await registerCommand("AddWinCommand");
	await registerCommand("RemoveWinCommand");
	await registerCommand("ModifyPointsCommand");
	await registerCommand("ProfileCommand");
	await registerCommand("LeaderboardCommand");
	await registerCommand("SettingsCommand");
	await registerCommand("RolesCommand");
	await registerCommand("AboutCommand");
	await registerCommand("HelpCommand");
	await registerCommand("MultiplierCommand");
	await registerCommand("RoleRefreshCommand");
	await registerCommand("ImportCommand");
	await registerCommand("RemoveDataCommand");
	await registerCommand("SetupCommand");
	await registerCommand("ShortCommand");
	await registerCommand("SubscribeFeed");
	await registerCommand("UnSubscribeFeed");
	await registerCommand("GraphCommand");
	await refreshSlashCommands();
});

client.on(Events.InteractionCreate, async interaction => {
	if (interaction.isContextMenuCommand()) {
		if (!(interaction.member instanceof GuildMember)) return;
		const context = getUser(interaction.member, interaction);
		if (!(context instanceof BotUserContext)) return;
		if (interaction.commandType === ApplicationCommandType.User) {
			let id = interaction.targetId;
			if (!id) return;
			await showProfileEmbed(context, id, 0, true);
		} else if (interaction.commandType === ApplicationCommandType.Message) {
			let id = interaction.targetId;
			if (!id) return;
			let message = await interaction.channel?.messages.fetch(id);
			if (!message) return;
			await showProfileEmbed(context, message.author.id, 0, true);
		}
		return;
	}
	handleFeedInteraction(interaction).catch(console.error);
	handleChannelInteraction(interaction).catch(console.error);
	if (!interaction.isChatInputCommand() || !(interaction.member instanceof GuildMember)) return;
	try {
		const context = getUser(interaction.member, interaction)
		const command = commandRegistry.get(interaction.commandName);

		if (!command) {
			console.error(`Command ${interaction.commandName} not found`);
			return;
		}

		if (command.requiresUser && !(context instanceof BotUserContext)) {
			interaction.reply(sendUninitializedError(interaction.user));
			return;
		}

		try {
			await interaction.deferReply();
			await command.execute(context);
		} catch (error) {
			console.error(error);
			await interaction.editReply({content: "An internal error occurred!"});
		}
	} catch (e) {
		console.error(e);
	}
});

client.on(Events.MessageCreate, async message => {
	if (message.author.bot || !(message.member instanceof GuildMember)) return;
	if (message.content === "") return; //Ignore empty messages (missing indent)
	try {
		let context = getUser(message.member, message);
		if (!(context instanceof BotUserContext)) {
			if (hasDialog(message)) handleDialog(context, message.content);
			else await message.reply(sendUninitializedError(message.author));
			return;
		}

		try {
			await handleMessage(context, message.content)
		} catch (error) {
			console.error(error);
			await message.reply("An internal error occurred!");
		}
	} catch (e) {
		console.error(e);
	}
});

client.on(Events.GuildDelete, async guild => {
	console.log(`Left guild ${guild.name} (${guild.id})`);
	console.log(`Deleting associated data...`);
	removeServerSetting(guild.id);
	db.deleteGuild(guild.id);
});

async function registerCommand(file: string) {
	await import(`./commands/${file}.js`).then((command) => {
		commandRegistry.set(command.default.slashData.name, command.default);
	});
}

async function refreshSlashCommands() {
	if (!client.user) return;
	const rest = new REST({version: '10'}).setToken(config.token);
	const commands = [];
	for (const command of commandRegistry.values()) {
		commands.push(command.slashData.toJSON());
	}
	commands.push(new ContextMenuCommandBuilder()
		.setName("View Profile")
		.setType(ApplicationCommandType.User)
		.setDMPermission(false));
	commands.push(new ContextMenuCommandBuilder()
		.setName("View Profile")
		.setType(ApplicationCommandType.Message)
		.setDMPermission(false));
	let commandTemp = await rest.put(Routes.applicationCommands(client.user.id), {body: commands});
	// @ts-ignore
	for (const command of commandTemp) {
		commandIdTable[command.name] = command.id;
	}
	console.log(`Registered ${commands.length} commands`);
}

export function getCommandId(name: string): string {
	return commandIdTable[name] || "0";
}

export function logAction(context: BotUserContext, action: string, color: ColorResolvable) {
	const channel = context.guild.channels.cache.get(context.context.log_channel_id);
	if (!(channel instanceof TextChannel)) return;
	channel.send({
		embeds: [
			new EmbedBuilder().setAuthor({name: context.user.tag, iconURL: context.user.displayAvatarURL()})
				.setDescription(action).setColor(color).setTimestamp().toJSON()
		]
	}).catch(console.error);
}

client.login(config.token).then(() => console.log("Authenticated to Discord API!"));

require("./util/APIServer");
require("./util/WebSocketServer");

export {db, rewards};