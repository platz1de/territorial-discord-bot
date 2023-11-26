import {ActionRowBuilder, ButtonBuilder, ButtonInteraction, ButtonStyle, EmbedBuilder, PermissionFlagsBits, SlashCommandBuilder, Snowflake} from "discord.js";
import {BotUserContext} from "../util/BotUserContext";
import {createErrorEmbed} from "../util/EmbedUtil";
import {setServerSetting} from "../BotSettingProvider";
import {unsubscribe} from "../util/GameDataDistributor";

export default {
	slashData: new SlashCommandBuilder().setName("unsubscribefeed").setDescription("UnSubscribe from a clan win feed")
		.setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
	execute: async (context: BotUserContext) => {
		if (context.context.webhooks.length === 0) {
			await context.reply(createErrorEmbed(context.user, "⚠ You are not subscribed to any feeds!"));
			return;
		}
		let rows = [];
		for (let i = 0; i < context.context.webhooks.length; i += 5) {
			const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
				...context.context.webhooks.slice(i, i + 5).map((webhook: { clan: string, channel: Snowflake }) => new ButtonBuilder().setStyle(ButtonStyle.Secondary).setCustomId(webhook.clan + " ".repeat(10) + webhook.channel).setLabel(webhook.clan))
			);
			rows.push(row);
		}
		let msg = await context.reply({
			embeds: [
				new EmbedBuilder().setAuthor(context.asAuthor()).setDescription("Please select the feed you want to unsubscribe from").setTimestamp().toJSON()
			],
			components: rows
		});

		if (!context.channel) return;
		const collector = context.channel.createMessageComponentCollector({time: 120000});
		collector.on("collect", async i => {
			if (!(i instanceof ButtonInteraction) || i.message.id !== msg.id || i.user.id !== context.user.id) return;
			await i.deferUpdate();
			const webhook = context.context.webhooks.find((webhook: { clan: string, channel: Snowflake }) => webhook.clan + " ".repeat(10) + webhook.channel === i.customId);
			if (!webhook) return;
			context.context.webhooks.splice(context.context.webhooks.indexOf(webhook), 1);
			unsubscribe(webhook.clan, webhook.url);
			setServerSetting(context.context);
			await msg.edit({
				embeds: [
					new EmbedBuilder().setAuthor(context.asAuthor()).setDescription(`Successfully unsubscribed from the clan win feed for \`${webhook.clan}\` in <#${webhook.channel}>!`).setTimestamp().toJSON()
				],
				components: []
			});
		});

		collector.on("end", async (collected, reason) => {
			try {
				reason === "time" && await msg.edit({components: []})
			} catch (e) {
			}
		});
	}
}