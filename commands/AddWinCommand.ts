import {ActionRowBuilder, BaseMessageOptions, ButtonBuilder, ButtonInteraction, ButtonStyle, ChatInputCommandInteraction, Colors, EmbedBuilder, GuildMember, Message, MessageFlags, ModalBuilder, SlashCommandBuilder, Snowflake, TextInputBuilder, TextInputStyle, User} from "discord.js";
import {PointCommand} from "../PointManager.js";
import {createErrorEmbed} from "../util/EmbedUtil.js";
import type {MultiplierSetting} from "../BotSettingProvider.js";
import {BulkPointTransaction} from "../util/BulkPointTransaction.js";
import {buildMessageReplyContext} from "../util/InteractionContext.js";
import {ServerContext} from "../util/ServerContext.js";

export default {
	slashData: new SlashCommandBuilder().setName("addwin").setDescription("Add win to a member")
		.addIntegerOption(option => option.setName("points").setDescription("The amount of points to add").setRequired(true))
		.addUserOption(option => option.setName("member").setDescription("The member to add points to")),
	execute: async (interaction: ChatInputCommandInteraction, context: ServerContext) => {
		const user: User = interaction.options.getUser("member") || interaction.user;
		const points: number = interaction.options.getInteger("points", true);
		if (user.id !== interaction.user.id && !context.hasModAccess(interaction)) {
			await interaction.editReply(createErrorEmbed(interaction.user, "❌ You can't add points to other members!"));
			return;
		}
		const err = await checkPointInput(points, interaction.user);
		if (err) {
			await interaction.editReply(err);
			return;
		}
		const multiplier = context.getActiveMultiplier();
		const transaction = new BulkPointTransaction(context.guild.id, multiplier, points, 1);
		await transaction.apply(user.id);
		if (user.id !== interaction.user.id) {
			context.logAction(interaction.user, `Added ${points} points to ${user}`, Colors.Yellow);
		}
		await showAddWinEmbed(context, interaction.user, points, [user.id], transaction, multiplier, interaction.editReply);
	}
} as PointCommand;

async function showAddWinEmbed(context: ServerContext, user: User, points: number, targets: Snowflake[], transaction: BulkPointTransaction, multiplier: MultiplierSetting | null, reply: (content: BaseMessageOptions) => Promise<Message>) {
	const msg = await reply({
		embeds: [
			new EmbedBuilder().setAuthor({name: user.tag, iconURL: user.displayAvatarURL()})
				.setDescription(transaction.getPart(user.id)!.buildDescription(targets.length === 1 && user.id === targets[0], transaction.affectedUserList(user.id)))
				.setTimestamp().setColor(targets.length === 1 && user.id === targets[0] ? Colors.Green : Colors.Yellow).toJSON()
		],
		components: [
			new ActionRowBuilder<ButtonBuilder>().addComponents(
				new ButtonBuilder().setStyle(ButtonStyle.Primary).setLabel("Edit 📝").setCustomId("edit")
			)
		]
	});

	if (!msg.channel) return;
	const collector = msg.channel.createMessageComponentCollector({time: 120000});
	collector.on("collect", async i => {
		if (!(i instanceof ButtonInteraction) || i.message.id !== msg.id || i.user.id !== user.id || i.customId !== "edit") return;
		await i.showModal(new ModalBuilder().setTitle("Edit Points").setCustomId("edit").addComponents(
			new ActionRowBuilder<TextInputBuilder>().addComponents(new TextInputBuilder().setLabel("The corrected amount of points").setCustomId("points").setPlaceholder("Points").setValue(points.toString()).setStyle(TextInputStyle.Short).setRequired(true).setMinLength(1).setMaxLength(10))
		));

		await i.awaitModalSubmit({time: 120000}).then(async i2 => {
			if (!(i2.member instanceof GuildMember)) return;
			if (i2.customId !== "edit" || i2.message?.id !== i.message.id || i2.user.id !== i.user.id) return;
			const input = i2.fields.getTextInputValue("points");
			const pointData = input.replaceAll("*", "x").replaceAll("×", "x").split("x").map(s => s.trim());
			let newPoints = parseInt(pointData[0]);
			for (let i = 1; i < Math.min(3, pointData.length); i++) {
				const factor = parseInt(pointData[i]);
				if (factor < 5) {
					newPoints *= factor;
				} else points = NaN;
			}
			await i2.deferReply({flags: MessageFlags.Ephemeral});
			const err = await checkPointInput(newPoints, i2.user);
			if (err) {
				await i2.editReply(err);
				return;
			}
			await transaction.editPoints(newPoints);
			context.logAction(user, `Edited ${targets.length === 1 ? `<@${targets[0]}>'s` : `<@${user.id}>'s bulk add`} win points by ${newPoints - points} (${points} -> ${newPoints})`, Colors.Yellow);
			collector.stop();
			await showAddWinEmbed(context, user, newPoints, targets, transaction, multiplier, reply);
			await i2.editReply({content: "✅ Points edited"});
		}).catch(async () => {
			//Timeout
		});
	});

	collector.on("end", async (collected, reason) => {
		try {
			reason === "time" && await msg.edit({components: []})
		} catch (e) {
		}
	});
}

async function checkPointInput(points: number, user: User) {
	if (points <= 0 || isNaN(points)) {
		return createErrorEmbed(user, "⚠ You need to specify a positive amount of points!");
	}
	if (points > 1024) { //2 * 512
		return createErrorEmbed(user, "⚠ Please only add as many points as you have gained!");
	}
	return false;
}

export async function tryAddEntryMessage(context: ServerContext, message: Message, content: string): Promise<boolean> {
	if (!context.getSettings().channel_id.includes(message.channel?.id || "0")) return false;
	let args = content.split(" ");
	const mentions: string[] = args.filter(arg => arg.match(/<@!?(\d+)>/));
	let targets: Snowflake[] = [];
	if (mentions.length === 0) {
		targets.push(message.author.id);
	} else {
		for (const mention of mentions) {
			// @ts-ignore
			const id = mention.match(/<@!?(\d+)>/)[1];
			const member = await context.guild.members.fetch(id);
			if (member) targets.push(member.id);
		}
	}
	targets = targets.filter((member, index, self) => self.indexOf(member) === index);
	if (targets.length === 0) {
		await message.reply(createErrorEmbed(message.author, "❌ No valid members found!"));
		return true;
	}
	if (targets.length > 1 && !context.hasModAccess(message)) {
		await message.reply(createErrorEmbed(message.author, "❌ You can't add points to multiple members!"));
		return true;
	}
	if (targets.length > 20) {
		await message.reply(createErrorEmbed(message.author, "❌ You can't add points to more than 20 members at once!"));
		return true;
	}
	args = args.filter(arg => !arg.startsWith("<@"));
	const pointData = args.join(" ").replaceAll("*", "x").replaceAll("×", "x").split("x").map(s => s.trim());
	let points = parseInt(pointData[0]);
	for (let i = 1; i < Math.min(3, pointData.length); i++) {
		const factor = parseInt(pointData[i]);
		if (factor < 5) {
			points *= factor;
		} else points = NaN;
	}
	if (isNaN(points) || points <= 0) {
		return false; //Not the right command probably
	}
	const err = await checkPointInput(points, message.author);
	if (err) {
		await message.reply(err);
		return true;
	}
	const multiplier = context.getActiveMultiplier();
	if (targets.length === 1) {
		const target = targets[0];
		if (target !== message.author.id && !context.hasModAccess(message)) {
			await message.reply(createErrorEmbed(message.author, "❌ You can't add points to other members!"));
			return true;
		}
		if (target !== message.author.id) {
			context.logAction(message.author, `Added ${points} points to <@${target}>`, Colors.Yellow);
		}
	} else {
		context.logAction(message.author, `Added ${points} points to ${targets.length} members`, Colors.Yellow);
	}
	const transaction = new BulkPointTransaction(context.guild.id, multiplier, points, 1);
	await Promise.all(targets.map(transaction.apply));
	await showAddWinEmbed(context, message.author, points, targets, transaction, multiplier, buildMessageReplyContext(message));
	return true;
}