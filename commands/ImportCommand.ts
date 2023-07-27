import {ActionRowBuilder, ButtonBuilder, ButtonInteraction, ButtonStyle, Colors, EmbedBuilder, Message, PermissionFlagsBits, SlashCommandBuilder} from "discord.js";
import {BotUserContext, getRawUser} from "../util/BotUserContext";
import {createConfirmationEmbed, createErrorEmbed} from "../util/EmbedUtil";
import {client, Command, config} from "../PointManager";
import {setServerSetting} from "../BotSettingProvider";

let importStatus: { [key: string]: { type: string } } = {};

export default {
	slashExclusive: true,
	slashData: new SlashCommandBuilder().setName("import").setDescription("Import points from third-party bots").setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),
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
					new ButtonBuilder().setStyle(ButtonStyle.Secondary).setLabel("UnbelievaBoat 🍕").setCustomId("import:unbelievaboat"),
					new ButtonBuilder().setStyle(ButtonStyle.Secondary).setLabel("Territorial.io Tracker ⚔").setCustomId("import:tracker"),
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
							await msg.reply(createErrorEmbed(context.user, `❌ You need to authorize the bot to manage points!\nPlease go to https://unbelievaboat.com/applications/authorize?app_id=${client.user?.id}&guild_id=${context.guild.id} and authorize the bot, then try again!`));
							return;
						} else {
							importUnbelievaBoat(context, msg);
						}
					}).catch(async e => {
						console.error(e);
						await msg.reply(createErrorEmbed(context.user, "❌ An error occurred while trying to import points!"));
					});
					break;
				case "import:tracker":
					importStatus[context.guild.id + ":" + context.user.id + ":" + context.channel?.id] = {type: "tracker"};
					await msg.reply(createConfirmationEmbed(context.user, "Paste the output of `t!clanboard <your clan>` here page by page. When you're done, type `done`. If you have more than 100 users and are stuck in rate limits / want to cancel, type `cancel`, the data will stay saved, so you can continue importing later."));
			}
		});

		collector.on("end", async (collected, reason) => {
			try {
				reason === "time" && await msg.edit({components: []})
			} catch (e) {
			}
		});
	},
	extraData: {
		checkImport: async (context: BotUserContext, message: Message) => {
			if (!importStatus[context.guild.id + ":" + context.user.id + ":" + context.channel?.id]) return false;
			const status = importStatus[context.guild.id + ":" + context.user.id + ":" + context.channel?.id];
			if (message.content === "done") {
				await message.reply(createConfirmationEmbed(context.user, "Marked as done!"));
				delete importStatus[context.guild.id + ":" + context.user.id + ":" + context.channel?.id];
				context.context.status |= 0x01;
				setServerSetting(context.context);
				return true;
			}
			if (message.content === "cancel") {
				await message.reply(createConfirmationEmbed(context.user, "Cancelled!"));
				delete importStatus[context.guild.id + ":" + context.user.id + ":" + context.channel?.id];
				return true;
			}
			if (status.type === "tracker") {
				const regex = /^\s*#\d+\s+(\S*)\s*\n\s*Wins:\s+(\d+)\s*$/gm;
				let promises: Promise<any>[] = [];
				let results: string[] = [];
				let match;
				while ((match = regex.exec(message.content)) !== null) {
					if (match.index === regex.lastIndex) regex.lastIndex++;
					const user = match[1];
					const wins = parseInt(match[2]);
					promises.push(new Promise<void>(async (resolve) => {
						context.guild.members.fetch({query: user, limit: 1}).then(async members => {
							const member = members.first();
							if (!member) {
								results.push("❌ Could not find user `" + user + "`!");
								return resolve();
							}
							const u = getRawUser(context.guild.id, member.id);
							if (!u) {
								results.push("❌ Could not find user `" + user + "`!");
								return resolve();
							}
							await u.modifyWins(wins);
							results.push("✅ Imported `" + user + "`!");
							resolve();
						}).catch(async e => {
							console.error(e);
							results.push("❌ Could not find user `" + user + "`!");
							return resolve();
						});
					}));
				}
				Promise.all(promises).then(async () => {
					await message.reply(createConfirmationEmbed(context.user, results.join("\n") + "\n\nType `done` to mark as done, or `cancel` to cancel!"));
					return true;
				});
				return true;
			}
			return false;
		}
	}
} as Command;

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