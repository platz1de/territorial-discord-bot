import {ActionRowBuilder, ButtonBuilder, ButtonInteraction, ButtonStyle, ChatInputCommandInteraction, Colors, EmbedBuilder, Guild, GuildMember, Message, ModalBuilder, SlashCommandBuilder, TextInputBuilder, TextInputStyle, User} from "discord.js";
import {config, db, hasModAccess, logAction} from "../PointManager";
import {createErrorEmbed, format, toRewardString} from "../util/EmbedUtil";
import BotInteraction from "../util/BotInteraction";
import {normalizeChanges, RewardAnswer} from "../util/RewardManager";

export default {
	slashExclusive: false,
	stringyNames: ["addpoints", "addpoint", "addp", "ap", "add", "addmoney", "addm", "am", "addcoins", "addc", "ac", "add-money", "add-coins", "add-win", "addwin", "add-win", "addw", "aw"],
	slashData: new SlashCommandBuilder().setName("addwin").setDescription("Add win to a member")
		.addIntegerOption(option => option.setName("points").setDescription("The amount of points to add").setRequired(true))
		.addUserOption(option => option.setName("member").setDescription("The member to add points to")),
	execute: async (interaction: ChatInputCommandInteraction) => {
		if (!(interaction.member instanceof GuildMember) || !(interaction.guild instanceof Guild)) throw new Error("Member not found");
		const user: User = interaction.options.getUser("member") || interaction.user;
		const member: GuildMember = await interaction.guild.members.fetch(user);
		const points: number = interaction.options.getInteger("points", true);
		if (member.id !== interaction.user.id && !hasModAccess(interaction.member)) {
			await interaction.editReply(createErrorEmbed(interaction.user, "❌ You can't add points to other members!"));
			return;
		}
		const err = await checkPointInput(points, interaction.user);
		if (err) {
			await interaction.editReply(err);
			return;
		}
		const multiplier = db.getSettingProvider().getMultiplier();
		let realPoints = points;
		if (multiplier) {
			realPoints = Math.ceil(points * multiplier.amount);
		}
		const response = await db.registerWin(member, realPoints);
		if (member.id === interaction.user.id) {
			logAction(interaction.member, `Added win of ${points} points`, Colors.Green, false);
		} else {
			logAction(interaction.member, `Added ${points} points to ${member}`, Colors.Yellow);
		}
		await showAddWinEmbed(new BotInteraction(interaction), points, member, response.reward, multiplier);
	},
	executeStringy: async (message: Message) => {
		if (!message.member || !message.guild) throw new Error("Member not found");
		if (!config.channel_id.includes(message.channel.id)) return;
		let args = message.content.split(" ");
		args.shift();
		const mentions: string[] = args.filter(arg => arg.match(/<@!?(\d+)>/));
		let targets: GuildMember[] = [];
		if (mentions.length === 0) {
			targets.push(message.member);
		} else {
			for (const mention of mentions) {
				// @ts-ignore
				const id = mention.match(/<@!?(\d+)>/)[1];
				const member = await message.guild.members.fetch(id);
				if (member) targets.push(member);
			}
		}
		targets = targets.filter((member, index, self) => self.indexOf(member) === index);
		if (targets.length === 0) {
			await message.reply(createErrorEmbed(message.author, "❌ No valid members found!"));
			return;
		}
		if (targets.length > 1 && !hasModAccess(message.member)) {
			await message.reply(createErrorEmbed(message.author, "❌ You can't add points to multiple members!"));
			return;
		}
		if (targets.length > 20) {
			await message.reply(createErrorEmbed(message.author, "❌ You can't add points to more than 20 members at once!"));
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
		const err = await checkPointInput(points, message.author);
		if (err) {
			await message.reply(err);
			return;
		}
		const multiplier = db.getSettingProvider().getMultiplier();
		let realPoints = points;
		if (multiplier) {
			realPoints = Math.ceil(points * multiplier.amount);
		}
		if (targets.length === 1) {
			const target = targets[0];
			if (target.id !== message.author.id && !hasModAccess(message.member)) {
				await message.reply(createErrorEmbed(message.author, "❌ You can't add points to other members!"));
				return;
			}
			const response = await db.registerWin(target, realPoints);
			if (target.id === message.author.id) {
				logAction(message.member, `Added win of ${points} points`, Colors.Green, false);
			} else {
				logAction(message.member, `Added ${points} points to ${target}`, Colors.Yellow);
			}
			await showAddWinEmbed(new BotInteraction(message), points, target, response.reward, multiplier);
		} else {
			let rewards: RewardAnswer[][] = [];
			for (const target of targets) {
				const response = await db.registerWin(target, realPoints);
				rewards.push(response.reward);
			}
			logAction(message.member, `Added ${points} points to ${targets.length} members`, Colors.Yellow);
			await showAddBulkEmbed(new BotInteraction(message), points, targets, rewards, multiplier);
		}
	}
}

async function showAddWinEmbed(interaction: BotInteraction, points: number, member: GuildMember, rewards: RewardAnswer[], multiplier?: { amount: number }) {
	const msg = await interaction.reply({
		embeds: [
			new EmbedBuilder().setAuthor({name: interaction.user.tag, iconURL: interaction.user.displayAvatarURL()}).setDescription(`Registered win of ${format(points)} ${multiplier ? `\`x ${multiplier.amount} (multiplier)\` ` : ``}points to ${interaction.user.id === member.id ? "your" : `${member}'s`} balance` + toRewardString(rewards, interaction.user.id === member.id, false)).setTimestamp().setColor(interaction.user.id === member.id ? Colors.Green : Colors.Yellow).toJSON()
		],
		components: [
			new ActionRowBuilder<ButtonBuilder>().addComponents(
				new ButtonBuilder().setStyle(ButtonStyle.Primary).setLabel("Edit 📝").setCustomId("edit")
			)
		]
	});

	const collector = interaction.channel.createMessageComponentCollector({time: 120000});
	collector.on("collect", async i => {
		if (!(i instanceof ButtonInteraction) || i.message.id !== msg.id || i.user.id !== interaction.user.id || i.customId !== "edit") return;
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
			rewards = normalizeChanges(rewards, (await db.modifyPoints(member, realDiff)).reward);
			logAction(i2.member, `Edited ${member}'s win points by ${diff} (${points} -> ${newPoints})`, Colors.Yellow);
			collector.stop();
			await showAddWinEmbed(interaction, newPoints, member, rewards, multiplier);
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

async function showAddBulkEmbed(interaction: BotInteraction, points: number, members: GuildMember[], rewards: RewardAnswer[][], multiplier?: { amount: number }) {
	const msg = await interaction.reply({
		embeds: [
			new EmbedBuilder().setAuthor({name: interaction.user.tag, iconURL: interaction.user.displayAvatarURL()}).setDescription(`Registered win of ${format(points)} ${multiplier ? `\`x ${multiplier.amount} (multiplier)\` ` : ``}points to\n${members.map((member, i) => (`${member}${toRewardString(rewards[i], false, true)}`)).join("\n")}`).setTimestamp().setColor(Colors.Yellow).toJSON()
		],
		components: [
			new ActionRowBuilder<ButtonBuilder>().addComponents(
				new ButtonBuilder().setStyle(ButtonStyle.Primary).setLabel("Edit 📝").setCustomId("edit")
			)
		]
	});

	const collector = interaction.channel.createMessageComponentCollector({time: 120000});
	collector.on("collect", async i => {
		if (!(i instanceof ButtonInteraction) || i.message.id !== msg.id || i.user.id !== interaction.user.id || i.customId !== "edit") return;
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
				rewards[i] = normalizeChanges(rewards[i], (await db.modifyPoints(members[i], realDiff)).reward);
			}
			logAction(i2.member, `Edited ${i2.member}'s bulk add win points by ${diff} (${points} -> ${newPoints})`, Colors.Yellow);
			collector.stop();
			await showAddBulkEmbed(interaction, newPoints, members, rewards, multiplier);
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