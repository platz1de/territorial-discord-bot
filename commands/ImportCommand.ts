import {ActionRowBuilder, ButtonBuilder, ButtonInteraction, ButtonStyle, Colors, EmbedBuilder, PermissionFlagsBits, SlashCommandBuilder} from "discord.js";
import {BotUserContext, getRawUser} from "../util/BotUserContext";
import {createErrorEmbed} from "../util/EmbedUtil";
import {config, PointCommand} from "../PointManager";
import {setServerSetting} from "../BotSettingProvider";

export default {
	slashData: new SlashCommandBuilder().setName("import").setDescription("Import points from third-party bots").setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
	execute: async (context: BotUserContext) => {
		if ((context.context.status & 0x01) === 1) {
			await context.reply(createErrorEmbed(context.user, `❌ This server already has points imported! If this process didn't work, please contact the bot support (see \`${context.context.prefix}about\`)`));
			return;
		}
		const msg = await context.reply({
			embeds: [
				new EmbedBuilder().setAuthor({name: context.user.tag, iconURL: context.user.displayAvatarURL()}).setTitle("Import points from third-party bots").setDescription(`This process will import points from third-party bots.\nNOTE: Wins can't be imported from most of these bots\nPlease select the bot you used before. If that bot does not exist, try contacting support to see if we can add it (see \`${context.context.prefix}about\`)`).setTimestamp().setColor(Colors.Blurple).toJSON()
			],
			components: [
				new ActionRowBuilder<ButtonBuilder>().addComponents(
					new ButtonBuilder().setStyle(ButtonStyle.Secondary).setLabel("UnbelievaBoat 🍕").setCustomId("import:unbelievaboat")
				)
			]
		});

		if (!context.channel) return;
		const collector = context.channel.createMessageComponentCollector({time: 120000});
		collector.on("collect", async i => {
			if (!(i instanceof ButtonInteraction) || i.message.id !== msg.id || i.user.id !== context.user.id) return;
			await msg.edit({components: []});
			switch (i.customId) {
				case "import:unbelievaboat":
					fetch("https://unbelievaboat.com/api/v1/applications/@me/guilds/" + context.guild.id, {
						method: "GET", headers: {Authorization: config.unbelieva_bot_token}
					}).then(async res => {
						const data = await res.json();
						if (!data.permissions || (data.permissions & 0x01) !== 1) {
							await msg.edit({components: []});
							await msg.reply(createErrorEmbed(context.user, `❌ You need to authorize the bot to manage points!\nPlease go to https://unbelievaboat.com/applications/authorize?app_id=${config.unbelieva_app_id}&guild_id=${context.guild.id} and authorize the bot, then try again!`));
							return;
						} else {
							importUnbelievaBoat(context, msg);
						}
					}).catch(async e => {
						console.error(e);
						await msg.reply(createErrorEmbed(context.user, "❌ An error occurred while trying to import points!"));
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

function importUnbelievaBoat(context: BotUserContext, msg: any, page: number = 1) {
	fetch("https://unbelievaboat.com/api/v1/guilds/" + context.guild.id + "/users/?sort=total&page=" + page, {
		method: "GET", headers: {Authorization: config.unbelieva_bot_token}
	}).then(async res => {
		const data = await res.json();
		if (!data.users || data.users.length === 0) {
			await msg.edit({components: []});
			await msg.reply(createErrorEmbed(context.user, "❌ No users found!"));
			return;
		}
		const users = data.users;
		const promises = [];
		for (const user of users) {
			const u = getRawUser(context.guild.id, user.user_id);
			if (!u) continue;
			promises.push(u?.modifyPoints(user.total));
		}
		await Promise.all(promises);
		await msg.reply({embeds: [new EmbedBuilder().setAuthor({name: context.user.tag, iconURL: context.user.displayAvatarURL()}).setTitle("Import points from third-party bots").setDescription(`Successfully imported ${data.users.length} users!`).setTimestamp().setColor(Colors.Green).toJSON()]});
		if (data.page < data.total_pages) {
			setTimeout(() => {
				importUnbelievaBoat(context, msg, data.page + 1);
			}, 5000);
		} else {
			context.context.status |= 0x01;
			setServerSetting(context.context);
		}
	}).catch(async e => {
		console.error(e);
		await msg.reply(createErrorEmbed(context.user, "❌ An error occurred while trying to import points!"));
	});
}