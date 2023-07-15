import {ActionRowBuilder, ButtonBuilder, ButtonInteraction, ButtonStyle, ChatInputCommandInteraction, Colors, EmbedBuilder, Message, SlashCommandBuilder} from "discord.js";
import BotInteraction from "../util/BotInteraction";
import {db, rewards} from "../PointManager";
import {Reward} from "../util/RewardManager";

export default {
	slashExclusive: false,
	stringyNames: ["settings", "options", "config", "conf", "st"],
	slashData: new SlashCommandBuilder().setName("settings").setDescription("Change your settings"),
	execute: async (interaction: ChatInputCommandInteraction) => {
		await showSettingsEmbed(new BotInteraction(interaction));
	},
	executeStringy: async (message: Message) => {
		await showSettingsEmbed(new BotInteraction(message));
	}
}

async function showSettingsEmbed(interaction: BotInteraction) {
	const settings = db.getSettingProvider().getUserSetting(interaction.user.id);
	const msg = await interaction.reply({
		embeds: [
			new EmbedBuilder().setAuthor({name: interaction.user.tag, iconURL: interaction.user.displayAvatarURL()})
				.addFields([
					{
						name: "Personal Settings",
						value: `🏷️ Roles: \`${settings.roles}\` (${settings.roles === "all" ? "Keep all roles you've unlocked" : "Only the highest role you've unlocked"})`, inline: true
					},
				])
				.setColor(Colors.Blurple).setFooter({
				text: "Click the buttons below to change your settings"
			}).setTimestamp().toJSON()
		],
		components: [
			new ActionRowBuilder<ButtonBuilder>().addComponents([
				new ButtonBuilder().setCustomId("roles").setEmoji("🏷️").setStyle(ButtonStyle.Primary)
			])
		]
	});

	const collector = interaction.channel.createMessageComponentCollector({time: 60000});
	collector.on("collect", async i => {
		if (i instanceof ButtonInteraction) {
			if (i.message.id !== msg.id || i.user.id !== interaction.user.id) return;
			await i.deferUpdate();
			const refresh = db.getSettingProvider().getUserSetting(interaction.user.id);
			switch (i.customId) {
				case "roles":
					refresh.roles = refresh.roles === "all" ? "highest" : "all";
					const member = await interaction.guild.members.fetch(interaction.user.id);
					const eligible: Reward[] = await rewards.calculateEligibleRoles(member);
					if (refresh.roles === "highest") {
						const filtered = rewards.filterByHierarchy(eligible);
						if (filtered.length > 0) {
							const remove = [];
							for (const role of eligible) {
								if (!filtered.includes(role)) {
									remove.push(role.role_id);
								}
							}
							member.roles.remove(remove, "Settings changed to only keep highest role").catch();
						}
					} else {
						member.roles.add(eligible.map(r => r.role_id), "Settings changed to all roles").catch();
					}
					break;
			}
			db.getSettingProvider().setUserSetting(interaction.user.id, refresh);
		} else {
			return;
		}
		collector.stop();
		await showSettingsEmbed(interaction);
	});

	collector.on("end", async (collected, reason) => {
		try {
			reason === "time" && await msg.edit({components: []})
		} catch (e) {
		}
	});
}