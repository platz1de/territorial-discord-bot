import {ActionRowBuilder, ButtonBuilder, ButtonInteraction, ButtonStyle, ChatInputCommandInteraction, Colors, EmbedBuilder, GuildMember, Message, ModalBuilder, SlashCommandBuilder, Snowflake, TextInputBuilder, TextInputStyle, User} from "discord.js";
import {Command, db, logAction} from "../PointManager";
import {createErrorEmbed, format, toRewardString} from "../util/EmbedUtil";
import {normalizeChanges, RewardAnswer} from "../util/RewardManager";
import {BotUserContext, getRawUser} from "../util/BotUserContext";

export default {
	slashExclusive: false,
	stringyNames: ["addpoints", "addpoint", "addp", "ap", "add", "addmoney", "addm", "am", "addcoins", "addc", "ac", "add-money", "add-coins", "add-win", "addwin", "add-win", "addw", "aw"],
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
		await showAddWinEmbed(context, points, user.id, response, multiplier);
	},
	executeStringy: async (context: BotUserContext) => {
		const message = context.base as Message;
		if (!context.context.channel_id.includes(message.channel.id)) return;
		let args = message.content.split(" ");
		args.shift();
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
			return;
		}
		if (targets.length > 1 && !context.hasModAccess()) {
			await context.reply(createErrorEmbed(context.user, "❌ You can't add points to multiple members!"));
			return;
		}
		if (targets.length > 20) {
			await context.reply(createErrorEmbed(context.user, "❌ You can't add points to more than 20 members at once!"));
			return;
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
		if (targets.length === 1) {
			const target = targets[0];
			if (target !== context.user.id && !context.hasModAccess()) {
				await context.reply(createErrorEmbed(context.user, "❌ You can't add points to other members!"));
				return;
			}
			const response = await getRawUser(context.guild.id, target)?.registerWin(realPoints) || [];
			if (target !== context.user.id) {
				logAction(context, `Added ${points} points to <@${target}>`, Colors.Yellow);
			}
			await showAddWinEmbed(context, points, target, response, multiplier);
		} else {
			let rewards: RewardAnswer[][] = [];
			for (const target of targets) {
				rewards.push(await getRawUser(context.guild.id, target)?.registerWin(realPoints) || []);
			}
			logAction(context, `Added ${points} points to ${targets.length} members`, Colors.Yellow);
			await showAddBulkEmbed(context, points, targets, rewards, multiplier);
		}
	}
} as Command;

async function showAddWinEmbed(context: BotUserContext, points: number, target: Snowflake, rewards: RewardAnswer[], multiplier?: { amount: number }) {
	const msg = await context.reply({
		embeds: [
			new EmbedBuilder().setAuthor({name: context.user.tag, iconURL: context.user.displayAvatarURL()}).setDescription(`Registered win of ${format(points)} ${multiplier ? `\`x ${multiplier.amount} (multiplier)\` ` : ``}points to ${context.user.id === target ? "your" : `<@${target}>'s`} balance` + toRewardString(rewards, context.user.id === target, false)).setTimestamp().setColor(context.user.id === target ? Colors.Green : Colors.Yellow).toJSON()
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
			rewards = normalizeChanges(rewards, await getRawUser(context.guild.id, target)?.modifyPoints(realDiff) || []);
			logAction(context, `Edited <@${target}>'s win points by ${diff} (${points} -> ${newPoints})`, Colors.Yellow);
			collector.stop();
			await showAddWinEmbed(context, newPoints, target, rewards, multiplier);
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

async function showAddBulkEmbed(context: BotUserContext, points: number, members: Snowflake[], rewards: RewardAnswer[][], multiplier?: { amount: number }) {
	const msg = await context.reply({
		embeds: [
			new EmbedBuilder().setAuthor({name: context.user.tag, iconURL: context.user.displayAvatarURL()}).setDescription(`Registered win of ${format(points)} ${multiplier ? `\`x ${multiplier.amount} (multiplier)\` ` : ``}points to\n${members.map((member, i) => (`<@${member}>${toRewardString(rewards[i], false, true)}`)).join("\n")}`).setTimestamp().setColor(Colors.Yellow).toJSON()
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
			for (let i = 0; i < members.length; i++) {
				rewards[i] = normalizeChanges(rewards[i], await getRawUser(context.guild.id, members[i])?.modifyPoints(realDiff) || []);
			}
			logAction(context, `Edited ${i2.member}'s bulk add win points by ${diff} (${points} -> ${newPoints})`, Colors.Yellow);
			collector.stop();
			await showAddBulkEmbed(context, newPoints, members, rewards, multiplier);
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