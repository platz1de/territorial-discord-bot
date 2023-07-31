import {Client, Collection, ColorResolvable, EmbedBuilder, Events, GatewayIntentBits, GuildMember, REST, Routes, SlashCommandBuilder, TextChannel} from "discord.js";
import rewards = require("./util/RewardManager");
import db = require("./db/DataBaseManager");
import {sendUninitializedError} from "./util/EmbedUtil";
import {handleDialog, hasDialog, startDialog} from "./util/SetupDisalogUtil";
import {BotUserContext, getUser} from "./util/BotUserContext";

export const config: { token: string, unbelieva_app_id: string, unbelieva_bot_token: string, endpoint_self: string } = require("./config.json");
export const client = new Client({intents: [GatewayIntentBits.MessageContent, GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages]});

export interface Command {
	slashExclusive: boolean,
	stringyNames: string[],
	slashData: SlashCommandBuilder | { name: string, toJSON(): any },
	updateSlashData?: () => void,
	execute: (context: BotUserContext) => Promise<void>,
	executeStringy: (context: BotUserContext) => Promise<void>,
	extraData?: any
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
	await registerCommand("ImportCommand");
	await registerCommand("EndpointCommand");
	await refreshSlashCommands();
});

client.on(Events.InteractionCreate, async interaction => {
	if (!interaction.isChatInputCommand() || !(interaction.member instanceof GuildMember)) return;
	try {
		let context = getUser(interaction.member, interaction)
		if (!context) {
			interaction.reply(sendUninitializedError(interaction.user));
			return;
		}
		const command = commandRegistry.get(interaction.commandName);

		if (!command) {
			console.error(`Command ${interaction.commandName} not found`);
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
	try {
		let context = getUser(message.member, message);
		if (!context) {
			if (message.content.startsWith("!setup")) startDialog(message);
			else if (hasDialog(message)) handleDialog(message);
			else if (message.content.startsWith("!")) await message.reply(sendUninitializedError(message.author));
			return;
		}
		if (message.content.startsWith(`<@${client.user?.id}>`) || message.content.startsWith(`<@!${client.user?.id}>`)) {
			await message.reply({content: `My prefix is \`${context.context.prefix}\``});
			return;
		}
		if (await commandRegistry.get("import")?.extraData?.checkImport(context, message)) return;
		if (!message.content.startsWith(context.context.prefix)) return;
		const command = stringyCommandRegistry.get(message.content.split(" ")[0].substring(context.context.prefix.length).toLowerCase());

		if (!command) {
			return;
		}

		try {
			await command.executeStringy(context);
		} catch (error) {
			console.error(error);
			await message.reply("An internal error occurred!");
		}
	} catch (e) {
		console.error(e);
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
	await rest.put(Routes.applicationCommands(client.user.id), {body: commands});
	console.log(`Registered ${commands.length} commands`);
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

export {db, rewards};