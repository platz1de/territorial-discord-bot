import {ActionRowBuilder, ButtonBuilder, ButtonInteraction, ButtonStyle, ChatInputCommandInteraction, Colors, EmbedBuilder, Message, PermissionFlagsBits, SlashCommandBuilder, User} from "discord.js";
import {getRawUser} from "../util/BotUserContext.js";
import {createErrorEmbed} from "../util/EmbedUtil.js";
import {config, getCommandId, PointCommand} from "../PointManager.js";
import {updateSettings} from "../BotSettingProvider.js";
import {ServerContext} from "../util/ServerContext.js";

export default {
	slashData: new SlashCommandBuilder().setName("import").setDescription("Import points from third-party bots").setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
	execute: async (interaction: ChatInputCommandInteraction, context: ServerContext) => {
		if ((context.getSettings().status & 0x01) === 1) {
			await interaction.editReply(createErrorEmbed(interaction.user, `❌ This server already has points imported! If this process didn't work, please contact the bot support (see \`</about:${getCommandId("about")}>\`)`));
			return;
		}
		const msg = await interaction.editReply({
			embeds: [
				new EmbedBuilder().setAuthor({name: interaction.user.tag, iconURL: interaction.user.displayAvatarURL()}).setTitle("Import points from third-party bots").setDescription(`This process will import points from third-party bots.\nNOTE: Wins can't be imported from most of these bots\nPlease select the bot you used before. If that bot does not exist, try contacting support to see if we can add it (see \`</about${getCommandId("about")}>\`)`).setTimestamp().setColor(Colors.Blurple).toJSON()
			],
			components: [
				new ActionRowBuilder<ButtonBuilder>().addComponents(
					new ButtonBuilder().setStyle(ButtonStyle.Secondary).setLabel("UnbelievaBoat 🍕").setCustomId("import:unbelievaboat")
				)
			]
		});

		if (!interaction.channel) return;
		const collector = interaction.channel.createMessageComponentCollector({time: 120000});
		collector.on("collect", async i => {
			if (!(i instanceof ButtonInteraction) || i.message.id !== msg.id || i.user.id !== interaction.user.id) return;
			await msg.edit({components: []});
			switch (i.customId) {
				case "import:unbelievaboat":
					fetch("https://unbelievaboat.com/api/v1/applications/@me/guilds/" + context.guild.id, {
						method: "GET", headers: {Authorization: config.unbelieva_bot_token}
					}).then(async res => {
						const data = await res.json();
						if (!data.permissions || (data.permissions & 0x01) !== 1) {
							await msg.edit({components: []});
							await msg.reply(createErrorEmbed(interaction.user, `❌ You need to authorize the bot to manage points!\nPlease go to https://unbelievaboat.com/applications/authorize?app_id=${config.unbelieva_app_id}&guild_id=${context.guild.id} and authorize the bot, then try again!`));
							return;
						} else {
							importUnbelievaBoat(context, interaction.user, msg);
						}
					}).catch(async e => {
						console.error(e);
						await msg.reply(createErrorEmbed(interaction.user, "❌ An error occurred while trying to import points!"));
					});
					break;
			}
		});

		collector.on("end", async (collected, reason) => {
			try {
				reason === "time" && await msg.edit({components: []})
			} catch (e) {
			}
		});
	}
} as PointCommand;

function importUnbelievaBoat(context: ServerContext, user: User, msg: Message, page: number = 1) {
	fetch("https://unbelievaboat.com/api/v1/guilds/" + context.guild.id + "/users/?sort=total&page=" + page, {
		method: "GET", headers: {Authorization: config.unbelieva_bot_token}
	}).then(async res => {
		const data = await res.json();
		if (!data.users || data.users.length === 0) {
			await msg.edit({components: []});
			await msg.reply(createErrorEmbed(user, "❌ No users found!"));
			return;
		}
		const users = data.users;
		const promises = [];
		for (const user of users) {
			const u = getRawUser(context.guild.id, user.user_id);
			if (!u) continue;
			promises.push(u?.modifyData(user.total, 0));
		}
		await Promise.all(promises);
		await msg.reply({embeds: [new EmbedBuilder().setAuthor({name: user.tag, iconURL: user.displayAvatarURL()}).setTitle("Import points from third-party bots").setDescription(`Successfully imported ${data.users.length} users!`).setTimestamp().setColor(Colors.Green).toJSON()]});
		if (data.page < data.total_pages) {
			setTimeout(() => {
				importUnbelievaBoat(context, user, msg, data.page + 1);
			}, 5000);
		} else {
			context.getSettings().status |= 0x01;
			updateSettings();
		}
	}).catch(async e => {
		console.error(e);
		await msg.reply(createErrorEmbed(user, "❌ An error occurred while trying to import points!"));
	});
}