import {ActionRowBuilder, ButtonBuilder, ButtonStyle, Colors, EmbedBuilder, GuildMember, Interaction, Message, MessageFlags, NewsChannel, StringSelectMenuBuilder, TextChannel} from "discord.js";
import {ServerSetting} from "../BotSettingProvider.js";
import {BotUserContext, getUser} from "./BotUserContext.js";
import {createConfirmationEmbed, createErrorEmbed, format, toRewardString} from "./EmbedUtil.js";
import {client} from "../PointManager.js";
import {getCacheForClan} from "./GameDataDistributor.js";

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
	let buttons = [];
	for (const factor in context.factor_buttons) {
		buttons.push(
			new ButtonBuilder().setCustomId(`claim_channel_factor_${factor}`).setLabel(context.factor_buttons[factor].name).setStyle(ButtonStyle.Primary)
		);
	}
	if (buttons.length === 0) {
		buttons.push(
			new ButtonBuilder().setCustomId("claim_channel").setLabel("Claim Points").setStyle(ButtonStyle.Primary)
		);
	}
	let content = {
		embeds: [
			new EmbedBuilder().setTitle("Claim Win").setDescription(context.claim_channel_description).setColor(Colors.Blue).setFooter({text: "Click the button below to claim your win"}).toJSON()
		],
		components: [
			new ActionRowBuilder<ButtonBuilder>().addComponents(buttons)
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
	if( !(interaction.isButton() || interaction.isStringSelectMenu()) || !(interaction.member instanceof GuildMember)) return;
	if (interaction.customId !== "claim_channel" && !interaction.customId.startsWith("claim_channel_factor_")) return;
	const context = getUser(interaction.member, interaction);
	if (!(context instanceof BotUserContext)) return;

	//Check Claim Win permissions
	if (!context.canClaimWin()) {
		await interaction.reply(
			createErrorEmbed(context.user, context.context.claim_win_roles_message, MessageFlags.Ephemeral ));
		return;
	}

	if (interaction.isButton()) {
		let clan = context.context.tag;
		if (!clan) {
			await interaction.reply(
				createErrorEmbed(context.user, "This server does not have a clan tag set!", MessageFlags.Ephemeral ));
			return;
		}
		let choices = getCacheForClan(clan);
		if (choices.length === 0) {
			await interaction.reply(
				createErrorEmbed(context.user, "There were no games won recently!", MessageFlags.Ephemeral ));
			return;
		}
		let factorId = "n";
		if (interaction.customId.startsWith("claim_channel_factor_")) {
			factorId = interaction.customId.substring(21);
		}
		interaction.reply({
			embeds: [
				new EmbedBuilder().setAuthor(context.asAuthor()).setDescription("Please select a game to claim the win for!").setColor(Colors.Blue).setTimestamp().toJSON()
			],
			components: [
				new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
					new StringSelectMenuBuilder().setCustomId("claim_channel").setPlaceholder("Select a game").addOptions(choices.map((choice) => {
						return {label: choice.contest ? "Contest with " + choice.playerCount + " players on " + choice.map : "Clan game with " + choice.playerCount + " players on " + choice.map, value: `${choice.contest ? "cont" : "norm"}-${choice.map}-${choice.playerCount}-${factorId}-${context.context.getActiveMultiplier()?.amount ?? ""}-` + Math.random().toString(10)}
					}))
				)
			],
			flags: MessageFlags.Ephemeral
		}).catch(() => {});
	} else if (interaction.isStringSelectMenu()) {
		if (interaction.customId !== "claim_channel") return;
		let parts = interaction.values[0].split("-");
		let contest = parts[0] === "cont";
		let map = parts[1];
		let points = parseInt(parts[2]) * (contest ? 2 : 1);
		let factor = parts[3];
		let multiplier = parts[4] ? Number( parts[4] ) : null; //multiplier is cached to avoid timing issues
		let realPoints = Math.ceil( points * ( multiplier ?? 1 ));

		if (factor !== "n") {
			if (!context.context.factor_buttons[parseInt(factor)]) return;
			realPoints = Math.ceil(realPoints * context.context.factor_buttons[parseInt(factor)].factor);
			points = Math.ceil(points * context.context.factor_buttons[parseInt(factor)].factor);
		}
		context.registerWin(realPoints).then((response) => {
			interaction.reply(
				createConfirmationEmbed( context.user,
					`Registered win of ${format(points)} ${multiplier ? `\`x ${multiplier} (multiplier)\` ` : ``}points to your balance` + toRewardString(response, false, false),
					MessageFlags.Ephemeral )
				).catch(() => {});;
			let channel = client.channels.cache.get(context.context.channel_id[0]);
			if (channel && channel instanceof TextChannel) {
				channel.send({
					embeds: [
						new EmbedBuilder().setAuthor({name: context.user.tag + " via Claim", iconURL: context.user.displayAvatarURL()}).setDescription(`Registered win of ${format(points)} ${multiplier ? `\`x ${multiplier} (multiplier)\` ` : ``}points to <@${context.id}>'s balance` + toRewardString(response, false, false)).setTimestamp().setColor(Colors.Green).setFooter({text: "Action was taken after button press"}).toJSON()
					]
				}).catch(() => {});
			}
		});
	}
}