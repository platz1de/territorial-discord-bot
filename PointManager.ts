import {ChatInputCommandInteraction, Client, Collection, ColorResolvable, EmbedBuilder, Events, GatewayIntentBits, Guild, GuildMember, Message, REST, Routes, SlashCommandBuilder, TextChannel} from "discord.js";
import * as fs from "fs";

const config: { token: string, guild_id: string, channel_id: string[], log_channel_id: string, prefix: string, mod_roles: { string: string }, rewards: [{ description: string, req_desc: string, role_id: string, type: string, dur: string, count: number, category: string }] } = require("./config.json");

const client = new Client({intents: [GatewayIntentBits.MessageContent, GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages]});

const db = require("./db/DataBaseManager");
const rewards = require("./util/RewardManager");

interface Command {
    slashExclusive: boolean,
    stringyNames: string[],
    slashData: SlashCommandBuilder | { name: string, toJSON(): any },
    updateSlashData?: () => void,
    execute: (interaction: ChatInputCommandInteraction) => void,
    executeStringy: (argument: Message) => void
}

const commandRegistry = new Collection<string, Command>();
const stringyCommandRegistry = new Collection<string, Command>();
let guild: Guild;

client.once(Events.ClientReady, async () => {
    let a = client.guilds.cache.get(config.guild_id);
    if (!a) throw new Error("Guild not found");
    guild = a;
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
    rewards.loadRewards(config.rewards);
});

client.on(Events.InteractionCreate, async interaction => {
    if (!interaction.isChatInputCommand()) return;
    if (!interaction.guild || interaction.guild.id !== config.guild_id) return;
    const command = commandRegistry.get(interaction.commandName);

    if (!command) {
        console.error(`Command ${interaction.commandName} not found`);
        return;
    }

    try {
        await interaction.deferReply();
        await command.execute(interaction);
    } catch (error) {
        console.error(error);
        await interaction.editReply({content: "An internal error occurred!"});
    }
});

client.on(Events.MessageCreate, async message => {
    if (message.author.bot) return;
    if (!message.guild || message.guild.id !== config.guild_id) return;
    if (!message.content.startsWith(config.prefix)) return;
    const command = stringyCommandRegistry.get(message.content.split(" ")[0].substring(config.prefix.length).toLowerCase());

    if (!command) {
        return;
    }

    try {
        await command.executeStringy(message);
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
    const data = await rest.put(Routes.applicationGuildCommands(client.user.id, config.guild_id),
        {body: commands},
    );
    console.log(`Registered ${commands.length} commands`);
}

function hasModAccess(member: GuildMember): boolean {
    for (const role of member.roles.cache.values() || []) {
        if (config.mod_roles.hasOwnProperty(role.id)) {
            return true;
        }
    }
    return false;
}

function logAction(member: GuildMember, action: string, color: ColorResolvable, channelLog: boolean = true) {
    const channel = guild.channels.cache.get(config.log_channel_id);
    if (!(channel instanceof TextChannel)) return;
    if (channelLog) channel.send({
        embeds: [
            new EmbedBuilder().setAuthor({name: member.user.tag, iconURL: member.user.displayAvatarURL()})
                .setDescription(action).setColor(color).setTimestamp().toJSON()
        ]
    });
    console.log(`[${member.user.tag}] ${action}`);
    fs.appendFileSync("./log.txt", `${(new Date()).toUTCString()}, ${member.user.tag}: ${action}\n`);
}

client.login(config.token).then(() => console.log("Authenticated to Discord API!"));

export {commandRegistry, db, rewards, logAction, hasModAccess, config, refreshSlashCommands};