import {ButtonStyle, ChatInputCommandInteraction, Colors, EmbedBuilder, GuildMember, Message, PermissionFlagsBits, SlashCommandBuilder, TextInputStyle} from "discord.js";
import {db, logAction} from "../PointManager";
import BotInteraction from "../util/BotInteraction";

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
    execute: async (interaction: ChatInputCommandInteraction) => {
        if (!(interaction.member instanceof GuildMember)) throw new Error("Member not found");
        const subcommand = interaction.options.getSubcommand();
        switch (subcommand) {
            case "set":
                if (db.getSettingProvider().getMultiplier() !== null) {
                    await interaction.editReply({embeds: [new EmbedBuilder().setAuthor({name: interaction.user.tag, iconURL: interaction.user.displayAvatarURL()}).setDescription(`A multiplier is already set, clear that one first!`).setTimestamp().setColor(Colors.Red).toJSON()]});
                    return;
                }
                let multiplier = interaction.options.getNumber("multiplier", true);
                let description = interaction.options.getString("description", true);
                let end = interaction.options.getString("end");
                if (isNaN(multiplier) || multiplier < 1 || multiplier > 5) {
                    await interaction.editReply({embeds: [new EmbedBuilder().setAuthor({name: interaction.user.tag, iconURL: interaction.user.displayAvatarURL()}).setDescription(`Multiplier must be at least 1 and at most 5`).setTimestamp().setColor(Colors.Red).toJSON()]});
                    return;
                }
                multiplier = Math.round(multiplier * 100) / 100;
                let processedEnd: number | null = null;
                if (end) {
                    const date = new Date(end + " UTC");
                    if (isNaN(date.getTime())) {
                        await interaction.editReply({embeds: [new EmbedBuilder().setAuthor({name: interaction.user.tag, iconURL: interaction.user.displayAvatarURL()}).setDescription(`Invalid date`).setTimestamp().setColor(Colors.Red).toJSON()]});
                        return;
                    }
                    processedEnd = date.getTime();
                }
                await db.getSettingProvider().setMultiplier(multiplier, processedEnd, description);
                logAction(interaction.member, `Multiplier set to ${multiplier}x`, Colors.Yellow);
                await interaction.editReply({embeds: [new EmbedBuilder().setAuthor({name: interaction.user.tag, iconURL: interaction.user.displayAvatarURL()}).setDescription(`Set multiplier to ${multiplier}x with description \`${description}\`${processedEnd ? ` ending at <t:${Math.min(processedEnd / 1000)}>` : ""}`).setTimestamp().setColor(Colors.Green).toJSON()]});
                break;
            case "clear":
                db.getSettingProvider().clearMultiplier();
                logAction(interaction.member, `Multiplier cleared`, Colors.Red);
                await interaction.editReply({embeds: [new EmbedBuilder().setAuthor({name: interaction.user.tag, iconURL: interaction.user.displayAvatarURL()}).setDescription(`Cleared the multiplier!`).setTimestamp().setColor(Colors.Yellow).toJSON()]});
                break;
            case "setend":
                const currentMultiplier = db.getSettingProvider().getMultiplier();
                if (!currentMultiplier) {
                    await interaction.editReply({embeds: [new EmbedBuilder().setAuthor({name: interaction.user.tag, iconURL: interaction.user.displayAvatarURL()}).setDescription(`No multiplier set`).setTimestamp().setColor(Colors.Red).toJSON()]});
                    return;
                }
                const endString = interaction.options.getString("date", true);
                const date = new Date(endString + " UTC");
                if (isNaN(date.getTime())) {
                    await interaction.editReply({embeds: [new EmbedBuilder().setAuthor({name: interaction.user.tag, iconURL: interaction.user.displayAvatarURL()}).setDescription(`Invalid date`).setTimestamp().setColor(Colors.Red).toJSON()]});
                    return;
                }
                currentMultiplier.end = date.getTime();
                db.getSettingProvider().setMultiplier(currentMultiplier.amount, currentMultiplier.end, currentMultiplier.description);
                logAction(interaction.member, `Multiplier end date set to <t:${Math.min(date.getTime() / 1000)}>`, Colors.Yellow);
                await interaction.editReply({embeds: [new EmbedBuilder().setAuthor({name: interaction.user.tag, iconURL: interaction.user.displayAvatarURL()}).setDescription(`Set multiplier end date to <t:${Math.min(date.getTime() / 1000)}>`).setTimestamp().setColor(Colors.Green).toJSON()]});
                break;
            case "info":
                await sendMultiplierInformation(new BotInteraction(interaction));
        }
    },
    executeStringy: async (message: Message) => {
        await sendMultiplierInformation(new BotInteraction(message));
    }
}

async function sendMultiplierInformation(interaction: BotInteraction) {
    const multiplier = db.getSettingProvider().getMultiplier();
    if (!multiplier) {
        await interaction.reply({embeds: [new EmbedBuilder().setAuthor({name: interaction.user.tag, iconURL: interaction.user.displayAvatarURL()}).setDescription(`No multiplier is currently active`).setTimestamp().setColor(Colors.Blurple).toJSON()]});
        return;
    }
    await interaction.reply({
        embeds: [new EmbedBuilder().setAuthor({name: interaction.user.tag, iconURL: interaction.user.displayAvatarURL()})
            .setFields(
                {name: `${multiplier.amount}x Multiplier`, value: `${multiplier.description}\n${multiplier.end ? `Ending in <t:${Math.min(multiplier.end / 1000)}:R>` : `No end set yet`}\nHappy grinding 🚀`, inline: true},
            ).setTimestamp().setColor(Colors.Blurple).toJSON()]
    });
}