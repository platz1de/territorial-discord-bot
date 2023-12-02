import {BotUserContext} from "./BotUserContext";
import {client, config} from "../PointManager";
import {tryAddEntryMessage} from "../commands/AddWinCommand";
import {tryRemoveEntryMessage} from "../commands/RemoveWinCommand";
import {tryProfileEntryMessage} from "../commands/ProfileCommand";
import {tryMultiplierEntryMessage} from "../commands/MultiplierCommand";
import {tryLeaderboardEntryMessage} from "../commands/LeaderboardCommand";
import {ActionRowBuilder, ButtonBuilder, ButtonInteraction, ButtonStyle, NewsChannel, TextChannel} from "discord.js";
import {getServerContext} from "../BotSettingProvider";

export async function handleMessage(context: BotUserContext, message: string) {
	if (message.startsWith("<@" + client.user?.id + ">")) message = message.substring((client.user?.id.length || 0) + 3);
	else if (message.startsWith("<@!" + client.user?.id + ">")) message = message.substring((client.user?.id.length || 0) + 4);
	message = message.trim();
	if (message === "") {
		await context.reply("Please use slash commands to interact with me.");
		return;
	}

	let args = message.split(" ");
	if (["add", "remove", "a", "r", "win", "add-win", "register", "register-win", "addpoints", "addwin", "points", "remove-win", "remove-points"].includes(args[0].toLowerCase())) {
		args.shift();
	}
	if (args.length === 0) {
		await context.reply("Please use slash commands to interact with me.");
		return;
	}

	if (args[0].toLowerCase() === "internal_send_message" && context.user.id === config.bot_owner) {
		let message = args.slice(1).join(" ");
		let msg = await context.reply({
			content: "Are you sure you want to send this message?\n\n" + message,
			components: [
				new ActionRowBuilder<ButtonBuilder>().addComponents(
					new ButtonBuilder().setCustomId("internal_send_message").setLabel("Confirm").setStyle(ButtonStyle.Success)
				)
			]
		});
		if (!msg) return;
		const collector = context.channel?.createMessageComponentCollector({time: 60000});
		collector?.on("collect", async i => {
			if (!(i instanceof ButtonInteraction) || i.customId !== "internal_send_message") return;
			if (i.user.id !== context.user.id) return;
			await i.deferUpdate();
			await i.editReply("Message sent!");
			let sent = 0;
			for (const guild of client.guilds.cache.values()) {
				const settings = getServerContext(guild.id);
				if (!settings) continue;
				if (!settings.update_channel_id) continue;
				const channel = guild.channels.cache.get(settings.update_channel_id);
				if (!(channel instanceof TextChannel || channel instanceof NewsChannel)) continue;
				await channel.send(message).catch(() => {}).then(() => sent++);
			}
			await context.reply(`Sent message to ${sent} servers!`);
		});
	}

	let ret = await tryAddEntryMessage(context, message);
	if (!ret) ret = await tryRemoveEntryMessage(context, message);
	if (!ret) ret = await tryLeaderboardEntryMessage(context, message);
	if (!ret) ret = await tryProfileEntryMessage(context, message);
	if (!ret) await tryMultiplierEntryMessage(context, message);
}