import {ChatInputCommandInteraction, Colors, EmbedBuilder, PermissionFlagsBits, SlashCommandBuilder} from "discord.js";
import {Command, db, logAction} from "../PointManager";
import {BotUserContext} from "../util/BotUserContext";
import {createConfirmationEmbed, createErrorEmbed} from "../util/EmbedUtil";

export default {
	slashExclusive: false,
	stringyNames: ["multiplier", "multi", "m", "mult"],
	slashData: new SlashCommandBuilder().setName("multiplier").setDescription("Modify the current multiplier")
		.addSubcommand(sub => sub.setName("set").setDescription("Set a new multiplier")
			.addNumberOption(option => option.setName("multiplier").setDescription("The new multiplier").setRequired(true))
			.addStringOption(option => option.setName("description").setDescription("Description of the multiplier (special event...)").setRequired(true))
			.addStringOption(option => option.setName("end").setDescription("End date of the multiplier"))
		)
		.addSubcommand(sub => sub.setName("clear").setDescription("Clear the current multiplier"))
		.addSubcommand(sub => sub.setName("setend").setDescription("Set end date of the current multiplier")
			.addStringOption(option => option.setName("date").setDescription("The new end date").setRequired(true))
		)
		.addSubcommand(sub => sub.setName("info").setDescription("Show the current multiplier"))
		.setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
	execute: async (context: BotUserContext) => {
		const interaction = context.base as ChatInputCommandInteraction;
		const subcommand = interaction.options.getSubcommand();
		switch (subcommand) {
			case "set":
				if (db.getSettingProvider().getMultiplier(context) !== null) {
					await context.reply(createErrorEmbed(context.user, "A multiplier is already set, clear that one first!"));
					return;
				}
				let multiplier = interaction.options.getNumber("multiplier", true);
				let description = interaction.options.getString("description", true);
				let end = interaction.options.getString("end");
				if (isNaN(multiplier) || multiplier < 1 || multiplier > 5) {
					await context.reply(createErrorEmbed(context.user, "Multiplier must be at least 1 and at most 5"));
					return;
				}
				multiplier = Math.round(multiplier * 100) / 100;
				let processedEnd: number | null = null;
				if (end) {
					const date = new Date(end + " UTC");
					if (isNaN(date.getTime())) {
						await context.reply(createErrorEmbed(context.user, "Invalid date"));
						return;
					}
					processedEnd = date.getTime();
				}
				await db.getSettingProvider().setMultiplier(context, multiplier, processedEnd, description);
				logAction(context, `Multiplier set to ${multiplier}x`, Colors.Yellow);
				await context.reply(createConfirmationEmbed(context.user, `Set multiplier to ${multiplier}x with description \`${description}\`${processedEnd ? ` ending at <t:${Math.min(processedEnd / 1000)}>` : ""}`));
				break;
			case "clear":
				db.getSettingProvider().clearMultiplier(context);
				logAction(context, `Multiplier cleared`, Colors.Red);
				await context.reply(createConfirmationEmbed(context.user, `Cleared the multiplier!`));
				break;
			case "setend":
				const currentMultiplier = db.getSettingProvider().getMultiplier(context);
				if (!currentMultiplier) {
					await context.reply(createErrorEmbed(context.user, `No multiplier set`));
					return;
				}
				const endString = interaction.options.getString("date", true);
				const date = new Date(endString + " UTC");
				if (isNaN(date.getTime())) {
					await context.reply(createErrorEmbed(context.user, `Invalid date`));
					return;
				}
				currentMultiplier.end = date.getTime();
				db.getSettingProvider().setMultiplier(context, currentMultiplier.end, currentMultiplier.description);
				logAction(context, `Multiplier end date set to <t:${Math.min(date.getTime() / 1000)}>`, Colors.Yellow);
				await context.reply(createConfirmationEmbed(context.user, `Set multiplier end date to <t:${Math.min(date.getTime() / 1000)}>`));
				break;
			case "info":
				await sendMultiplierInformation(context);
		}
	},
	executeStringy: sendMultiplierInformation
} as Command;

async function sendMultiplierInformation(context: BotUserContext) {
	const multiplier = db.getSettingProvider().getMultiplier(context);
	if (!multiplier) {
		await context.reply({embeds: [new EmbedBuilder().setAuthor({name: context.user.tag, iconURL: context.user.displayAvatarURL()}).setDescription(`No multiplier is currently active`).setTimestamp().setColor(Colors.Blurple).toJSON()]});
		return;
	}
	await context.reply({
		embeds: [new EmbedBuilder().setAuthor({name: context.user.tag, iconURL: context.user.displayAvatarURL()})
			.setFields(
				{name: `${multiplier.amount}x Multiplier`, value: `${multiplier.description}\n${multiplier.end ? `Ending in <t:${Math.min(multiplier.end / 1000)}:R>` : `No end set yet`}\nHappy grinding 🚀`, inline: true},
			).setTimestamp().setColor(Colors.Blurple).toJSON()]
	});
}