import {ChatInputCommandInteraction, Colors, EmbedBuilder, Message, SlashCommandBuilder} from "discord.js";
import {rewards} from "../PointManager";
import BotInteraction from "../util/BotInteraction";
import {Reward} from "../util/RewardManager";

export default {
    slashExclusive: false,
    stringyNames: ["roles", "promotions", "rankups", "rewards"],
    slashData: new SlashCommandBuilder().setName("roles").setDescription("See a list off all available role rewards"),
    execute: async (interaction: ChatInputCommandInteraction) => {
        await showRoleEmbed(new BotInteraction(interaction));
    },
    executeStringy: async (message: Message) => {
        await showRoleEmbed(new BotInteraction(message));
    }
}

async function showRoleEmbed(interaction: BotInteraction) {
    const roles: Reward[] = rewards.getRewardList();
    const categories: string[] = [];
    for (const role of roles) {
        if (!categories.includes(role.category)) categories.push(role.category);
    }
    await interaction.reply({
        embeds: [
            new EmbedBuilder().setAuthor({name: `Available reward roles`, iconURL: interaction.guild.iconURL() || undefined})
                .addFields(categories.map(category => {
                    return {
                        name: category,
                        value: roles.filter(role => role.category === category).map(role => `<@&${role.role_id}> • ${role.description}`).join("\n")
                    }
                })).setColor(Colors.Blurple).setTimestamp().toJSON()
        ]
    });
}