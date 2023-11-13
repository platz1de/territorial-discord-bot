import {SlashCommandBuilder} from "discord.js";
import {Command, db} from "../PointManager";
import {BotUserContext} from "../util/BotUserContext";

export default {
	slashExclusive: true,
	slashData: new SlashCommandBuilder().setName("removedata").setDescription("Remove ALL your data from the bot"),
	execute: async (context: BotUserContext) => {
		let channel = await context.user.createDM();
		channel.send("Are you sure you want to remove ALL your data from the bot?}\n\n**This action is irreversible!**\n\nType `yes` within the next 30 seconds to confirm, or anything else to cancel.")
			.then(async () => {
				await context.reply("✅ I've sent you a DM!");
				const filter = (message: any) => message.author.id === context.user.id;
				channel.awaitMessages({filter, max: 1, time: 30000, errors: ["time"]})
					.then(async collected => {
						let message = collected.first();
						if (message?.content.toLowerCase() === "yes") {
							message?.react("✅");
							await context.deleteUser();
							db.getSettingProvider().removeOptOut(context.user.id)
							await context.reply("✅ Your data has been removed!");
							console.log(`Removed user ${context.user.tag} (${context.user.id})`);
						} else {
							message?.react("❌");
							await context.reply("❌ Action cancelled!");
						}
					})
					.catch(async () => {
						await context.reply("❌ Action cancelled!");
					});
			})
			.catch(async () => {
				await context.reply("❌ I couldn't DM you! Make sure you have DMs enabled!");
			});
	}
} as Command;