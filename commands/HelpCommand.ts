import {EmbedBuilder, SlashCommandBuilder} from "discord.js";
import {client, GenericCommand, getCommandId} from "../PointManager";
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
</addwin:${getCommandId("addwin")}> - Register a win for yourself
</removewin:${getCommandId("removewin")}> - Remove a win (if misadded)
</profile:${getCommandId("profile")}> - See your or someone else's profile
</leaderboard:${getCommandId("leaderboard")}> - See the leaderboard
</roles:${getCommandId("roles")}> - See all role rewards
</help:${getCommandId("help")}> - See this list
</shortcommands:${getCommandId("shortcommands")}> - See a list of legacy-style commands (shorter and faster to type)
</about:${getCommandId("about")}> - See infos about the bot`
						},
						{
							name: "Moderation", value: `
</addwin:${getCommandId("addwin")}> - Register a win for someone else
</removewin:${getCommandId("removewin")}> - Remove a win from someone else
</modifypoints:${getCommandId("modifypoints")}> - Modify a user's points or wins
</rolerefresh:${getCommandId("rolerefresh")}> - Recalculate a user's roles`
						},
						{
							name: "Admin", value: `
</multiplier set:${getCommandId("multiplier")}> - Set the current multiplier
</multiplier clear:${getCommandId("multiplier")}> - Remove the current multiplier
</multiplier setend:${getCommandId("multiplier")}> - Set the end date of the current multiplier
</settings show:${getCommandId("settings")}> - Change server settings`
						}
					).setTimestamp().toJSON()
			]
		});
	},
} as GenericCommand;