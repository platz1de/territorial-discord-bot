import {ActionRowBuilder, AttachmentBuilder, ButtonBuilder, ButtonInteraction, ButtonStyle, ChatInputCommandInteraction, Colors, EmbedBuilder, Guild, GuildMember, Message, SlashCommandBuilder, Snowflake, User} from "discord.js";
import {db, rewards} from "../PointManager";
import BotInteraction from "../util/BotInteraction";
import {format} from "../util/EmbedUtil";
import {ServerSetting} from "../BotSettingProvider";

const QuickChart = require("quickchart-js");

export default {
    slashExclusive: false,
    stringyNames: ["profile", "p", "bal", "balance", "pb"],
	slashData: new SlashCommandBuilder().setName("profile").setDescription("See a member's profile")
        .addUserOption(option => option.setName("member").setDescription("The member to view")),
    execute: async (setting: ServerSetting, interaction: ChatInputCommandInteraction) => {
        if (!(interaction.guild instanceof Guild)) throw new Error("Guild not found");
        const user: User = interaction.options.getUser("member") || interaction.user;
        await showProfileEmbed(setting, await interaction.guild.members.fetch(user.id), new BotInteraction(interaction), 0);
    },
    executeStringy: async (setting: ServerSetting, message: Message) => {
        if (!(message.guild instanceof Guild) || !(message.member instanceof GuildMember)) throw new Error("Guild not found");
        let user = message.author;
        if (message.content.split(" ").length > 1) {
            const arg = message.content.split(" ")[1];
            if (arg.startsWith("<@") && arg.endsWith(">")) {
                const id = arg.replace(/[<@!>]/g, "");
                await message.client.users.fetch(id).catch(() => null).then(u => user = u ?? user);
            } else if (arg.match(/^[0-9]+$/)) {
                await message.client.users.fetch(arg).catch(() => null).then(u => user = u ?? user);
            } else {
                const res = message.client.users.cache.find(u => u.tag.toLowerCase().startsWith(arg.toLowerCase()));
                if (res) user = res;
            }
        }
        await showProfileEmbed(setting, await message.guild.members.fetch(user.id).catch(() => null) ?? message.member, new BotInteraction(message), 0);
    }
}

async function showProfileEmbed(setting: ServerSetting, member: GuildMember, interaction: BotInteraction, page: number) {
    const embed = new EmbedBuilder();
    let files: AttachmentBuilder[] = [];
    switch (page) {
        case 0:
            const gp = db.getGlobalProvider();
            const global = await gp.getData(setting, member);
            embed.addFields(
				{name: "Lifetime", value: `Points: ${format(global.points)} (#${await gp.getPointRank(setting, member)})\nWins: ${format(global.wins)} (#${await gp.getWinRank(setting, member)})`, inline: true}
            );
            break;
        case 1:
            const next: { role: Snowflake, has: number, needs: number }[] = await rewards.getProgress(setting, member);
            embed.addFields(
                next.length > 0 ? {name: "Next Reward", value: next.map(r => `<@&${r.role}>\n[${'🟦'.repeat(Math.floor(r.has / r.needs * 10))}${'⬜'.repeat(10 - Math.floor(r.has / r.needs * 10))}] ${r.has}/${r.needs} (${Math.floor(r.has / r.needs * 100)}%)`).join("\n\n")}
                    : {name: "All done", value: "You already have all the rewards, good job!"}
            );
            break;
        case 2:
            const data: { day: string, wins: number, points: number }[] = await db.getDailyProvider().getLegacyData(setting, member, 30);
            const qc = new QuickChart();
            qc.setConfig({
                type: "line",
                data: {
                    labels: data.map(d => d.day),
                    datasets: [
                        {label: "Points", data: data.map(d => d.points), yAxisID: "A"},
                        {label: "Wins", data: data.map(d => d.wins), yAxisID: "B"}
                    ]
                },
                options: {
                    scales: {
                        yAxes: [{
                            id: "A",
                            type: "linear",
                            position: "left"
                        }, {
                            id: "B",
                            type: "linear",
                            position: "right"
                        }]
                    }
                }
            });
            try {
                files.push(new AttachmentBuilder(await qc.toBinary()).setName("chart.png"));
                embed.setImage("attachment://chart.png");
            } catch (e) {
                embed.setDescription("Failed to generate chart, please try again");
                console.error(e);
            }
            break;
    }
    const msg = await interaction.reply({
        embeds: [
            embed.setAuthor({name: member.user.tag, iconURL: member.displayAvatarURL()}).setColor(Colors.Green).setTimestamp().toJSON()
        ], components: [
            new ActionRowBuilder<ButtonBuilder>().addComponents(
                new ButtonBuilder().setCustomId("profile").setEmoji("👤").setStyle(ButtonStyle.Primary).setDisabled(page === 0),
                new ButtonBuilder().setCustomId("progress").setEmoji("🚀").setStyle(ButtonStyle.Primary).setDisabled(page === 1),
                new ButtonBuilder().setCustomId("chart").setEmoji("📊").setStyle(ButtonStyle.Primary).setDisabled(page === 2),
                new ButtonBuilder().setCustomId("seasons").setEmoji("🗃️").setStyle(ButtonStyle.Primary).setDisabled(page === 3)
            )
        ],
        files: files
    });

    const collector = interaction.channel.createMessageComponentCollector({time: 60000});
    collector.on("collect", async i => {
        if (i instanceof ButtonInteraction) {
            if (i.message.id !== msg.id || i.user.id !== interaction.user.id) return;
            await i.deferUpdate();
            const pages = ["profile", "progress", "chart", "seasons"];
            collector.stop();
            await showProfileEmbed(setting, member, interaction, pages.indexOf(i.customId));
        } else {
            return;
        }
    });

    collector.on("end", async (collected, reason) => {
        try {
            reason === "time" && await msg.edit({components: []})
        } catch (e) {
        }
    });
}