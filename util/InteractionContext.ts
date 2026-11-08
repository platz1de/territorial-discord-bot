import {BaseMessageOptions, GuildMember, Interaction, InteractionEditReplyOptions, Message, MessagePayload} from "discord.js";
import {InteractionTypes} from "./BaseUserContext.js";

// TODO: remove this placeholder when we have proper contexts
export function buildMessageReplyContext(message: Message) {
	let last: Message | null = null;
	return async (content: BaseMessageOptions) => {
		if (last) {
			return await last.edit(content);
		} else {
			return last = await message.reply(content);
		}
	}
}