import {ChatInputCommandInteraction, NewsChannel, PermissionFlagsBits, SlashCommandBuilder, TextChannel} from "discord.js";
import {BotUserContext} from "../util/BotUserContext";
import {createConfirmationEmbed, createErrorEmbed} from "../util/EmbedUtil";
import {subscribe} from "../util/GameDataDistributor";
import {setServerSetting} from "../BotSettingProvider";

export default {
	slashData: new SlashCommandBuilder().setName("subscribefeed").setDescription("Subscribe to a clan win feed")
		.addStringOption(option => option.setName("clan").setDescription("The clan name, 'all' for all clans").setRequired(true))
		.addChannelOption(option => option.setName("channel").setDescription("The channel to send the feed to").setRequired(true))
		.setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
	execute: async (context: BotUserContext) => {
		const interaction = context.base as ChatInputCommandInteraction;
		const clan = interaction.options.getString("clan", true).toUpperCase().trim();
		if (clan.length === 0 || clan.length > 7) {
			await context.reply(createErrorEmbed(interaction.user, "⚠ Please specify a valid clan name!"));
			return;
		}
		const channel = interaction.options.getChannel("channel", true);
		if (!(channel instanceof TextChannel || channel instanceof NewsChannel)) {
			await context.reply(createErrorEmbed(interaction.user, "⚠ Please select a text channel!"));
			return;
		}
		let webhook;
		for (const w of context.context.webhooks) {
			if (w.clan === clan && w.channel === channel.id) {
				await context.reply(createErrorEmbed(interaction.user, "⚠ You are already subscribed to that feed!"));
				return;
			}
			if (w.channel === channel.id) {
				webhook = w.url;
				break;
			}
		}
		if (context.context.webhooks.length >= 10) {
			await context.reply(createErrorEmbed(interaction.user, "⚠ You can only subscribe to 10 feeds at a time!"));
			return;
		}
		if (!webhook) {
			webhook = await channel.createWebhook({name: "Clan Win Feed"}).catch(() => {
				context.reply(createErrorEmbed(interaction.user, "⚠ I don't have permission to create webhooks in that channel!"));
			});
			webhook = webhook?.url;
		}
		if (!webhook) return;
		context.context.webhooks.push({clan: clan, channel: channel.id, url: webhook});
		await context.reply(createConfirmationEmbed(interaction.user, `✅ Successfully subscribed to the clan win feed for \`${clan}\` in <#${channel.id}>!`));
		subscribe(clan, webhook);
		setServerSetting(context.context);
	}
}