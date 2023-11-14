import {EmbedBuilder, SlashCommandBuilder} from "discord.js";
import {client, GenericCommand} from "../PointManager";
import {BaseUserContext} from "../util/BaseUserContext";

export default {
	slashData: new SlashCommandBuilder().setName("shortcommands").setDescription("See a command list"),
	execute: async (context: BaseUserContext) => {
		const ping = "<@" + client.user?.id + "> ";
		await context.reply({
			embeds: [
				new EmbedBuilder().setAuthor({name: client.user?.tag ?? "Unknown", iconURL: client.user?.displayAvatarURL()})
					.setFields(
						{
							name: "General", value: `
Some commands have short alternative forms to make them faster to type:
**${ping}<points>** - Register a win for yourself
**${ping}<points> [@user1] [@user2]** - Bulk add points (up to 20 users)
**${ping}-<points>** - Remove a win (if misadded)
**${ping}p** - See your profile
**${ping}<@user>** - See someone else's profile
**${ping}lb** - See the leaderboard
**${ping}7d** - See the leaderboard for the last 7 days (available 1-30)
**${ping}mult** - See the current multiplier (if any)
All Commands also work by replying to my message (instead of typing the mention)`
						}
					).setTimestamp().toJSON()
			]
		});
	},
} as GenericCommand;