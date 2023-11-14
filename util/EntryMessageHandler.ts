import {BotUserContext} from "./BotUserContext";
import {client} from "../PointManager";
import {tryAddEntryMessage} from "../commands/AddWinCommand";
import {tryRemoveEntryMessage} from "../commands/RemoveWinCommand";
import {tryProfileEntryMessage} from "../commands/ProfileCommand";
import {tryMultiplierEntryMessage} from "../commands/MultiplierCommand";
import {tryLeaderboardEntryMessage} from "../commands/LeaderboardCommand";

export async function handleMessage(context: BotUserContext, message: string) {
	if (message.startsWith("<@" + client.user?.id + ">")) message = message.substring((client.user?.id.length || 0) + 3);
	else if (message.startsWith("<@!" + client.user?.id + ">")) message = message.substring((client.user?.id.length || 0) + 4);
	message = message.trim();
	if (message === "") {
		await context.reply("Please use slash commands to interact with me.");
		return;
	}

	let args = message.split(" ");
	if (["add", "remove", "a", "r", "win", "add-win", "register", "register-win", "addpoints", "addwin", "points", "remove-win", "remove-points"].includes(args[0].toLowerCase())) {
		args.shift();
	}
	if (args.length === 0) {
		await context.reply("Please use slash commands to interact with me.");
		return;
	}

	let ret = await tryAddEntryMessage(context, message);
	if (!ret) ret = await tryRemoveEntryMessage(context, message);
	if (!ret) ret = await tryLeaderboardEntryMessage(context, message);
	if (!ret) ret = await tryProfileEntryMessage(context, message);
	if (!ret) await tryMultiplierEntryMessage(context, message);
}