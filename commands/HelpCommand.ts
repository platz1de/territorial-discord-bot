import {EmbedBuilder, SlashCommandBuilder} from "discord.js";
import {client, GenericCommand} from "../PointManager";
import {BaseUserContext} from "../util/BaseUserContext";

export default {
	slashData: new SlashCommandBuilder().setName("help").setDescription("See a command list"),
	execute: async (context: BaseUserContext) => {
		await context.reply({
			embeds: [
				new EmbedBuilder().setAuthor({name: client.user?.tag ?? "Unknown", iconURL: client.user?.displayAvatarURL()})
					.setFields(
						{
							name: "General", value: `
**add <points>** - Register a win for yourself
**remove <points>** - Remove a win (if misadded)
**profile [@user]** - See your or someone else's profile
**lb** - See the leaderboard
**lb 7d** - See the leaderboard for the last 7 days (available 1-30)
**mult** - See the current multiplier (if any)
**roles** - See all role rewards
**help** - See this list
**shortcommands** - See a list of legacy-style commands (shorter and faster to type)
**about** - See infos about the bot`
						},
						{
							name: "Moderation", value: `
</addwin:1129749479453642844> - Register a win for someone else
</removewin:1129749479453642845> - Remove a win from someone else
</modifypoints:1129749479453642846> - Modify a user's points or wins`
						},
						{
							name: "Admin", value: `
</multiplier set:1129749479642365993> - Set the current multiplier
</multiplier clear:1129749479642365993> - Remove the current multiplier
</multiplier setend:1129749479642365993> - Set the end date of the current multiplier
</settings show:1129906100985151524> - Change server settings`
						}
					).setTimestamp().toJSON()
			]
		});
	},
} as GenericCommand;