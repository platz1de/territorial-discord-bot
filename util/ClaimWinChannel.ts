import {ActionRowBuilder, ButtonBuilder, ButtonStyle, Colors, EmbedBuilder, GuildMember, Interaction, Message, NewsChannel, StringSelectMenuBuilder, TextChannel} from "discord.js";
import {ServerSetting} from "../BotSettingProvider";
import {BotUserContext, getUser} from "./BotUserContext";
import {format, toRewardString} from "./EmbedUtil";
import {client} from "../PointManager";
import {getClanForGuild} from "./TTHQ";
import {getCacheForClan} from "./GameDataDistributor";

export async function getOrSendMessage(context: ServerSetting) {
	if (!context.claim_channel) return;
	const guild = client.guilds.cache.get(context.guild_id);
	if (!guild) return;
	const channel = guild.channels.cache.get(context.claim_channel);
	if (!channel || !(channel instanceof TextChannel || channel instanceof NewsChannel)) return;
	const history = await channel.messages.fetch({limit: 100});
	let message: Message | undefined;
	for (const msg of history.values()) {
		if (msg.author.id === client.user?.id && msg.embeds.length > 0 && msg.embeds[0].title === "Claim Win") {
			message = msg;
			break;
		}
	}
	let content = {
		embeds: [
			new EmbedBuilder().setTitle("Claim Win").setDescription(context.claim_channel_description).setColor(Colors.Blue).setFooter({text: "Click the button below to claim your win"}).toJSON()
		],
		components: [
			new ActionRowBuilder<ButtonBuilder>().addComponents(
				new ButtonBuilder().setCustomId("claim_channel").setLabel("Claim Win").setStyle(ButtonStyle.Primary)
			)
		]
	};
	if (!message) {
		try {
			message = await channel.send(content);
			if (!message) return;
		} catch (e) {
			return;
		}
	} else {
		message.edit(content).catch(() => {});
	}
}

export async function handleChannelInteraction(interaction: Interaction) {
	if (interaction.isButton() && interaction.member instanceof GuildMember) {
		if (interaction.customId !== "claim_channel") return;
		const context = getUser(interaction.member, interaction);
		if (!(context instanceof BotUserContext)) return;
		let clan = getClanForGuild(context.guild.id);
		if (!clan) {
			interaction.reply({
				embeds: [
					new EmbedBuilder().setAuthor(context.asAuthor()).setDescription("This channel is not associated with a clan! The TTHQ Endpoint was set up wrong!").setColor(Colors.Red).setTimestamp().toJSON()
				],
				ephemeral: true
			});
			return;
		}
		let choices = getCacheForClan(clan);
		if (choices.length === 0) {
			interaction.reply({
				embeds: [
					new EmbedBuilder().setAuthor(context.asAuthor()).setDescription("There were no games won recently!").setColor(Colors.Red).setTimestamp().toJSON()
				],
				ephemeral: true
			});
			return;
		}
		interaction.reply({
			embeds: [
				new EmbedBuilder().setAuthor(context.asAuthor()).setDescription("Please select a game to claim the win for!").setColor(Colors.Blue).setTimestamp().toJSON()
			],
			components: [
				new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
					new StringSelectMenuBuilder().setCustomId("claim_channel").setPlaceholder("Select a game").addOptions(choices.map((choice) => {
						return {label: choice.contest ? "Contest with " + choice.points + " points on " + choice.map : choice.points + " points on " + choice.map, value: `${choice.contest ? "cont" : "norm"}-${choice.map}-${choice.points}`}
					}))
				)
			],
			ephemeral: true
		});
	} else if (interaction.isStringSelectMenu() && interaction.member instanceof GuildMember) {
		if (interaction.customId !== "claim_channel") return;
		const context = getUser(interaction.member, interaction);
		if (!(context instanceof BotUserContext)) return;
		let value = interaction.values[0];
		let parts = value.split("-");
		let contest = parts[0] === "cont";
		let map = parts[1];
		let points = parseInt(parts[2]) * (contest ? 2 : 1);
		let realPoints = points;
		if (context.context.multiplier) {
			realPoints = Math.ceil(realPoints * context.context.multiplier.amount);
		}
		context.registerWin(realPoints).then((response) => {
			interaction.reply({
				embeds: [
					new EmbedBuilder().setAuthor(context.asAuthor()).setDescription(`Registered win of ${format(points)} ${context.context.multiplier ? `\`x ${context.context.multiplier.amount} (multiplier)\` ` : ``}points to your balance` + toRewardString(response, false, false)).setColor(Colors.Green).setTimestamp().toJSON()
				],
				ephemeral: true
			});
			let channel = client.channels.cache.get(context.context.channel_id[0]);
			if (channel && channel instanceof TextChannel) {
				channel.send({
					embeds: [
						new EmbedBuilder().setAuthor({name: context.user.tag + " via Claim", iconURL: context.user.displayAvatarURL()}).setDescription(`Registered win of ${format(points)} ${context.context.multiplier ? `\`x ${context.context.multiplier.amount} (multiplier)\` ` : ``}points to <@${context.id}>'s balance` + toRewardString(response, false, false)).setTimestamp().setColor(Colors.Green).setFooter({text: "Action was taken after button press"}).toJSON()
					]
				}).catch(() => {});
			}
		});
	}
}