import {ButtonInteraction, ChatInputCommandInteraction, Guild, GuildMember, Message, MessageContextMenuCommandInteraction, Snowflake, StringSelectMenuInteraction, TextBasedChannel, User, UserContextMenuCommandInteraction} from "discord.js";
import {Database} from "better-sqlite3";
import {client, db} from "../PointManager.js";
import {createServerContext} from "./ServerContext.js";

export type InteractionTypes = ChatInputCommandInteraction | StringSelectMenuInteraction | ButtonInteraction | MessageContextMenuCommandInteraction | UserContextMenuCommandInteraction;

export class BaseUserContext {
	id: Snowflake;
	db: Database;
	base: Message | InteractionTypes | null;
	user: User;
	member: GuildMember | undefined;
	guild: Guild;
	channel: TextBasedChannel | undefined;

	constructor(id: Snowflake, base: Message | InteractionTypes | null, guild: Guild | null = null) {
		this.id = id;
		this.db = db.getProvider();
		this.base = base;
		if (base && base.guild) {
			this.guild = base.guild;
		} else if (guild) {
			this.guild = guild;
		} else {
			throw new Error("Guild not found");
		}
		if (base instanceof Message) this.user = base.author;
		else if (!base) this.user = client.user as User; //Dummy user
		else this.user = base.user;
		if (base && base.member) this.member = base.member as GuildMember;
		if (base && base.channel) {
			this.channel = base.channel;
		}
	}

	fetchMember(): Promise<void> {
		return new Promise(resolve => {
			if (this.member) {
				resolve();
			} else {
				this.guild.members.fetch(this.id).then(member => {
					this.user = member.user;
					this.member = member;
					resolve();
				}).catch(() => {
					resolve();
				});
			}
		});
	}

	asAuthor(): { name: string, iconURL: string } {
		return {name: this.user.tag, iconURL: this.user.displayAvatarURL()};
	}

	toServerContext() {
		return createServerContext(this.guild)!;
	}

	async deleteUser() {
		this.db.prepare("DELETE FROM global_points WHERE member = ?").run(this.id);
		this.db.prepare("DELETE FROM daily_points WHERE member = ?").run(this.id);
	}
}