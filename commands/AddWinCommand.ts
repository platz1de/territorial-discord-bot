import {ActionRowBuilder, ButtonBuilder, ButtonInteraction, ButtonStyle, ChatInputCommandInteraction, Colors, EmbedBuilder, GuildMember, Message, ModalBuilder, SlashCommandBuilder, Snowflake, TextInputBuilder, TextInputStyle, User} from "discord.js";
import {db, logAction, PointCommand} from "../PointManager";
import {createErrorEmbed, format, toRewardString} from "../util/EmbedUtil";
import {normalizeChanges, RewardAnswer} from "../util/RewardManager";
import {BotUserContext, getRawUser} from "../util/BotUserContext";

export default {
	slashData: new SlashCommandBuilder().setName("addwin").setDescription("Add win to a member")
		.addIntegerOption(option => option.setName("points").setDescription("The amount of points to add").setRequired(true))
		.addUserOption(option => option.setName("member").setDescription("The member to add points to")),
	execute: async (context: BotUserContext) => {
		const interaction = context.base as ChatInputCommandInteraction;
		const user: User = interaction.options.getUser("member") || context.user;
		const points: number = interaction.options.getInteger("points", true);
		if (user.id !== context.user.id && !context.hasModAccess()) {
			await context.reply(createErrorEmbed(context.user, "❌ You can't add points to other members!"));
			return;
		}
		const err = await checkPointInput(points, context.user);
		if (err) {
			await context.reply(err);
			return;
		}
		const multiplier = db.getSettingProvider().getMultiplier(context);
		let realPoints = points;
		if (multiplier) {
			realPoints = Math.ceil(points * multiplier.amount);
		}
		const response = await getRawUser(context.guild.id, user.id)?.registerWin(realPoints) || [];
		if (user.id !== context.user.id) {
			logAction(context, `Added ${points} points to ${user}`, Colors.Yellow);
		}
		await showAddWinEmbed(context, points, [user.id], [response], multiplier);
	}
} as PointCommand;

async function showAddWinEmbed(context: BotUserContext, points: number, targets: Snowflake[], rewards: RewardAnswer[][], multiplier?: { amount: number }) {
	let memberString;
	if (targets.length === 1) {
		memberString = `${context.user.id === targets[0] ? "your" : `<@${targets[0]}>'s`} balance${toRewardString(rewards[0], context.user.id === targets[0], false)}`;
	} else {
		memberString = `\n${targets.map((member, i) => (`<@${member}>${toRewardString(rewards[i], false, true)}`)).join("\n")}`;
	}
	const msg = await context.reply({
		embeds: [
			new EmbedBuilder().setAuthor(context.asAuthor())
				.setDescription(`Registered win of ${format(points)} ${multiplier ? `\`x ${multiplier.amount} (multiplier)\` ` : ``}points to ${memberString}`)
				.setTimestamp().setColor(targets.length === 1 && context.user.id === targets[0] ? Colors.Green : Colors.Yellow).toJSON()
		],
		components: [
			new ActionRowBuilder<ButtonBuilder>().addComponents(
				new ButtonBuilder().setStyle(ButtonStyle.Primary).setLabel("Edit 📝").setCustomId("edit")
			)
		]
	});

	if (!context.channel) return;
	const collector = context.channel.createMessageComponentCollector({time: 120000});
	collector.on("collect", async i => {
		if (!(i instanceof ButtonInteraction) || i.message.id !== msg.id || i.user.id !== context.user.id || i.customId !== "edit") return;
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
			await i2.deferReply({ephemeral: true});
			const err = await checkPointInput(newPoints, i2.user);
			if (err) {
				await i2.editReply(err);
				return;
			}
			const diff = newPoints - points;
			let realDiff = diff;
			if (multiplier) {
				realDiff = Math.ceil(diff * multiplier.amount);
			}
			for (let i = 0; i < targets.length; i++) {
				rewards[i] = normalizeChanges(rewards[i], await getRawUser(context.guild.id, targets[i])?.modifyPoints(realDiff) || []);
			}
			logAction(context, `Edited ${targets.length === 1 ? `<@${targets[0]}>'s` : `<@${context.member}>'s bulk add`} win points by ${diff} (${points} -> ${newPoints})`, Colors.Yellow);
			collector.stop();
			await showAddWinEmbed(context, newPoints, targets, rewards, multiplier);
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

export async function tryAddEntryMessage(context: BotUserContext, message: string): Promise<boolean> {
	if (!context.context.channel_id.includes(context.channel?.id || "0")) return false;
	let args = message.split(" ");
	const mentions: string[] = args.filter(arg => arg.match(/<@!?(\d+)>/));
	let targets: Snowflake[] = [];
	if (mentions.length === 0) {
		targets.push(context.id);
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
		await context.reply(createErrorEmbed(context.user, "❌ No valid members found!"));
		return true;
	}
	if (targets.length > 1 && !context.hasModAccess()) {
		await context.reply(createErrorEmbed(context.user, "❌ You can't add points to multiple members!"));
		return true;
	}
	if (targets.length > 20) {
		await context.reply(createErrorEmbed(context.user, "❌ You can't add points to more than 20 members at once!"));
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
	const err = await checkPointInput(points, context.user);
	if (err) {
		await context.reply(err);
		return true;
	}
	const multiplier = db.getSettingProvider().getMultiplier(context);
	let realPoints = points;
	if (multiplier) {
		realPoints = Math.ceil(points * multiplier.amount);
	}
	if (targets.length === 1) {
		const target = targets[0];
		if (target !== context.user.id && !context.hasModAccess()) {
			await context.reply(createErrorEmbed(context.user, "❌ You can't add points to other members!"));
			return true;
		}
		if (target !== context.user.id) {
			logAction(context, `Added ${points} points to <@${target}>`, Colors.Yellow);
		}
	} else {
		logAction(context, `Added ${points} points to ${targets.length} members`, Colors.Yellow);
	}
	let rewards: RewardAnswer[][] = [];
	for (const target of targets) {
		rewards.push(await getRawUser(context.guild.id, target)?.registerWin(realPoints) || []);
	}
	await showAddWinEmbed(context, points, targets, rewards, multiplier);
	return true;
}