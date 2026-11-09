import {ChatInputCommandInteraction, NewsChannel, PermissionFlagsBits, SlashCommandBuilder, TextChannel} from "discord.js";
import {createConfirmationEmbed, createErrorEmbed} from "../util/EmbedUtil.js";
import {subscribe} from "../util/GameDataDistributor.js";
import {updateSettings} from "../BotSettingProvider.js";
import {PointCommand} from "../PointManager.js";
import {ServerContext} from "../util/ServerContext.js";

export default {
	slashData: new SlashCommandBuilder().setName("subscribefeed").setDescription("Subscribe to a clan win feed")
		.addStringOption(option => option.setName("clan").setDescription("The clan name, 'all' for all clans").setRequired(true))
		.addChannelOption(option => option.setName("channel").setDescription("The channel to send the feed to").setRequired(true))
		.setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
	execute: async (interaction: ChatInputCommandInteraction, context: ServerContext) => {
		const clan = interaction.options.getString("clan", true).toUpperCase().trim();
		if (clan.length === 0 || clan.length > 7) {
			await interaction.editReply(createErrorEmbed(interaction.user, "⚠ Please specify a valid clan name!"));
			return;
		}
		const channel = interaction.options.getChannel("channel", true);
		if (!(channel instanceof TextChannel || channel instanceof NewsChannel)) {
			await interaction.editReply(createErrorEmbed(interaction.user, "⚠ Please select a text channel!"));
			return;
		}
		let webhook;
		for (const w of context.getSettings().webhooks) {
			if (w.clan === clan && w.channel === channel.id) {
				await interaction.editReply(createErrorEmbed(interaction.user, "⚠ You are already subscribed to that feed!"));
				return;
			}
			if (w.channel === channel.id) {
				webhook = w.url;
				break;
			}
		}
		if (context.getSettings().webhooks.length >= 10) {
			await interaction.editReply(createErrorEmbed(interaction.user, "⚠ You can only subscribe to 10 feeds at a time!"));
			return;
		}
		if (!webhook) {
			webhook = await channel.createWebhook({name: "Clan Win Feed"}).catch(() => {
				interaction.editReply(createErrorEmbed(interaction.user, "⚠ I don't have permission to create webhooks in that channel!"));
			});
			webhook = webhook?.url;
		}
		if (!webhook) return;
		context.getSettings().webhooks.push({clan: clan, channel: channel.id, url: webhook});
		await interaction.editReply(createConfirmationEmbed(interaction.user, `✅ Successfully subscribed to the clan win feed for \`${clan}\` in <#${channel.id}>!`));
		subscribe(clan, webhook);
		updateSettings();
	}
} as PointCommand;