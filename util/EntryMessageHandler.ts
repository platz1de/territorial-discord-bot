import {client, config} from "../PointManager.js";
import {tryAddEntryMessage} from "../commands/AddWinCommand.js";
import {tryRemoveEntryMessage} from "../commands/RemoveWinCommand.js";
import {tryProfileEntryMessage} from "../commands/ProfileCommand.js";
import {tryMultiplierEntryMessage} from "../commands/MultiplierCommand.js";
import {tryLeaderboardEntryMessage} from "../commands/LeaderboardCommand.js";
import {ActionRowBuilder, ButtonBuilder, ButtonInteraction, ButtonStyle, Message, NewsChannel, TextChannel} from "discord.js";
import {getServerContext} from "../BotSettingProvider.js";
import {createServerContext} from "./ServerContext.js";

export async function handleMessage(message: Message) {
	let content = message.content;
	if (content.startsWith("<@" + client.user?.id + ">")) content = content.substring((client.user?.id.length || 0) + 3);
	else if (content.startsWith("<@!" + client.user?.id + ">")) content = content.substring((client.user?.id.length || 0) + 4);
	content = content.trim();
	if (content === "") {
		await message.reply("Please use slash commands to interact with me.");
		return;
	}

	let args = content.split(" ");
	if (["add", "remove", "a", "r", "win", "add-win", "register", "register-win", "addpoints", "addwin", "points", "remove-win", "remove-points"].includes(args[0].toLowerCase())) {
		args.shift();
	}
	if (args.length === 0) {
		await message.reply("Please use slash commands to interact with me.");
		return;
	}

	if (args[0].toLowerCase() === "internal_send_message" && message.author.id === config.bot_owner) {
		let broadcastMessage = args.slice(1).join(" ");
		let msg = await message.reply({
			content: "Are you sure you want to send this message?\n\n" + broadcastMessage,
			components: [
				new ActionRowBuilder<ButtonBuilder>().addComponents(
					new ButtonBuilder().setCustomId("internal_send_message").setLabel("Confirm").setStyle(ButtonStyle.Success)
				)
			]
		});
		if (!msg) return;
		const collector = message.channel?.createMessageComponentCollector({time: 60000});
		collector?.on("collect", async i => {
			if (!(i instanceof ButtonInteraction) || i.customId !== "internal_send_message") return;
			if (i.user.id !== message.author.id) return;
			await i.deferUpdate();
			await i.editReply("Message sent!");
			let sent = 0;
			for (const guild of client.guilds.cache.values()) {
				const settings = getServerContext(guild.id);
				if (!settings) continue;
				if (!settings.update_channel_id) continue;
				const channel = guild.channels.cache.get(settings.update_channel_id);
				if (!(channel instanceof TextChannel || channel instanceof NewsChannel)) continue;
				await channel.send(broadcastMessage).catch(() => {}).then(() => sent++);
			}
			await msg.edit(`Sent message to ${sent} servers!`);
		});
		return;
	}

	const context = createServerContext(message.guild);
	if (!context) return;

	let ret = await tryLeaderboardEntryMessage(context, message, content);
	if (!ret) ret = await tryAddEntryMessage(context, message, content);
	if (!ret) ret = await tryRemoveEntryMessage(context, message, content);
	if (!ret) ret = await tryProfileEntryMessage(context, message, content);
	if (!ret) await tryMultiplierEntryMessage(context, message, content);
}