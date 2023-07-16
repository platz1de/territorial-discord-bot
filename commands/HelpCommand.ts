import {ButtonStyle, ChatInputCommandInteraction, EmbedBuilder, Message, SlashCommandBuilder} from "discord.js";
import {config} from "../PointManager";
import BotInteraction from "../util/BotInteraction";
import {ServerSetting} from "../BotSettingProvider";

export default {
	slashExclusive: false,
	stringyNames: ["help", "commands", "cmds", "cmd", "command"],
	slashData: new SlashCommandBuilder().setName("help").setDescription("See a command list"),
	execute: async (setting: ServerSetting, interaction: ChatInputCommandInteraction) => {
		await showHelpEmbed(setting, new BotInteraction(interaction));
	},
	executeStringy: async (setting: ServerSetting, message: Message) => {
		await showHelpEmbed(setting, new BotInteraction(message));
	}
}

async function showHelpEmbed(setting: ServerSetting, interaction: BotInteraction) {
	const prefix = setting.prefix;
	await interaction.reply({
		embeds: [
			new EmbedBuilder().setAuthor({name: interaction.client.user?.tag ?? "Unknown", iconURL: interaction.client.user?.displayAvatarURL()})
				.setFields(
					{
						name: "General", value: `
                        **${prefix}add <points>** - Register a win for yourself
                        **${prefix}remove-win <points>** - Remove a win (if misadded)
                        **${prefix}profile [@user]** - See your or someone else's profile
                        **${prefix}lb** - See the leaderboard
                        **${prefix}lb 7d** - See the leaderboard for the last 7 days (available 1-30)
                        **${prefix}clb** - See the cult leaderboard
                        **${prefix}cult [name]** - See a cult's profile
                        **${prefix}mult** - See the current multiplier (if any)
                        **${prefix}roles** - See all role rewards
                        **${prefix}help** - See this list
                        **${prefix}about** - See infos about the bot`
					},
					{
						name: "Moderation", value: `
                        </addwin:1055502533277265942> - Register a win for someone else
                        </removewin:1057961241273962506> - Remove a win from someone else
                        </modifypoints:1055502533277265943> - Modify a user's points or wins`
					},
					{
						name: "Admin", value: `
                        </endseason:1055502533277265945> - End the current season
                        </multiplier set:1059233998058045512> - Set the current multiplier
                        </multiplier clear:1059233998058045512> - Remove the current multiplier
                        </multiplier setend:1059233998058045512> - Set the end date of the current multiplier
                        </cult add:1071538592805040221> - Add a cult
                        </cult remove:1071538592805040221> - Remove a cult
                        </cult role:1071538592805040221> - Set a cult's role
                        </cult name:1071538592805040221> - Set a cult's name
                        </cult description:1071538592805040221> - Set a cult's color
                        </cult icon:1071538592805040221> - Set a cult's icon
                        </cult open:1071538592805040221> - Toggle a cult's open status`
					}
				).setTimestamp().toJSON()
		]
	});
}