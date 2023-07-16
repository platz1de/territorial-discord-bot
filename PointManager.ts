import {ChatInputCommandInteraction, Client, Collection, ColorResolvable, EmbedBuilder, Events, GatewayIntentBits, GuildMember, Message, REST, Routes, SlashCommandBuilder, TextChannel} from "discord.js";
import rewards = require("./util/RewardManager");
import db = require("./db/DataBaseManager");
import {getServerContext, ServerSetting} from "./BotSettingProvider";
import {sendUninitializedError} from "./util/EmbedUtil";
import {handleDialog, hasDialog, startDialog} from "./util/SetupDisalogUtil";
import BotInteraction from "./util/BotInteraction";

const config: { token: string } = require("./config.json");
const client = new Client({intents: [GatewayIntentBits.MessageContent, GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages]});

interface Command {
	slashExclusive: boolean,
	stringyNames: string[],
	slashData: SlashCommandBuilder | { name: string, toJSON(): any },
	updateSlashData?: () => void,
	execute: (setting: ServerSetting, interaction: ChatInputCommandInteraction) => void,
	executeStringy: (setting: ServerSetting, argument: Message) => void
}

const commandRegistry = new Collection<string, Command>();
const stringyCommandRegistry = new Collection<string, Command>();

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
	await refreshSlashCommands();
});

client.on(Events.InteractionCreate, async interaction => {
	if (!interaction.isChatInputCommand() || !interaction.guild) return;
	let context = getServerContext(interaction.guild.id);
	if (!context) {
		try {
			interaction.reply(sendUninitializedError(interaction.user));
		} catch (e) {
			console.error(e);
		}
		return;
	}
	const command = commandRegistry.get(interaction.commandName);

	if (!command) {
		console.error(`Command ${interaction.commandName} not found`);
		return;
	}

	try {
		await interaction.deferReply();
		await command.execute(context, interaction);
	} catch (error) {
		console.error(error);
		await interaction.editReply({content: "An internal error occurred!"});
	}
});

client.on(Events.MessageCreate, async message => {
	if (message.author.bot || !message.guild || !message.channel) return;
	let context = getServerContext(message.guild.id);
	let interaction = new BotInteraction(message);
	if (!context) {
		try {
			if (message.content.startsWith("!setup")) startDialog(interaction);
			else if (hasDialog(interaction)) handleDialog(interaction, message.content);
			else if (message.content.startsWith("!")) await interaction.reply(sendUninitializedError(message.author));
		} catch (e) {
			console.error(e);
		}
		return;
	}
	if (message.content.startsWith(`<@${client.user?.id}>`) || message.content.startsWith(`<@!${client.user?.id}>`)) {
		await interaction.reply({content: `My prefix is \`${context.prefix}\``});
		return;
	}
	if (!message.content.startsWith(context.prefix)) return;
	const command = stringyCommandRegistry.get(message.content.split(" ")[0].substring(context.prefix.length).toLowerCase());

	if (!command) {
		return;
	}

	try {
		await command.executeStringy(context, message);
	} catch (error) {
		console.error(error);
		await message.reply("An internal error occurred!");
	}
});

async function registerCommand(file: string) {
	await import(`./commands/${file}.js`).then((command) => {
		commandRegistry.set(command.default.slashData.name, command.default);
		if (!command.default.slashExclusive) {
			for (const name of command.default.stringyNames) {
				stringyCommandRegistry.set(name, command.default);
			}
		}
	});
}

async function refreshSlashCommands() {
	if (!client.user) return;
	const rest = new REST({version: '10'}).setToken(config.token);
	const commands = [];
	for (const command of commandRegistry.values()) {
		commands.push(command.slashData.toJSON());
	}
	const data = await rest.put(Routes.applicationCommands(client.user.id), {body: commands});
	console.log(`Registered ${commands.length} commands`);
}

function hasModAccess(setting: ServerSetting, member: GuildMember): boolean {
	for (const role of member.roles.cache.values() || []) {
		if (setting.mod_roles.includes(role.id)) {
			return true;
		}
	}
	return false;
}

function logAction(setting: ServerSetting, member: GuildMember, action: string, color: ColorResolvable, channelLog: boolean = true) {
	const guild = client.guilds.cache.get(setting.guild_id);
	if (!guild) return;
	const channel = guild.channels.cache.get(setting.log_channel_id);
	if (!(channel instanceof TextChannel)) return;
	channel.send({
		embeds: [
			new EmbedBuilder().setAuthor({name: member.user.tag, iconURL: member.user.displayAvatarURL()})
				.setDescription(action).setColor(color).setTimestamp().toJSON()
		]
	}).catch(console.error);
}

client.login(config.token).then(() => console.log("Authenticated to Discord API!"));

export {commandRegistry, db, rewards, logAction, hasModAccess, config, refreshSlashCommands};