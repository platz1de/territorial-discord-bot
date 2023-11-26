import {BaseMessageOptions, ButtonInteraction, ChatInputCommandInteraction, Guild, GuildMember, Message, MessagePayload, Snowflake, StringSelectMenuInteraction, TextBasedChannel, User} from "discord.js";
import {Database} from "sqlite3";
import {client, db} from "../PointManager";

export class BaseUserContext {
	id: Snowflake;
	db: Database;
	base: Message | ChatInputCommandInteraction | ButtonInteraction | StringSelectMenuInteraction | null;
	last: Message | undefined;
	user: User;
	member: GuildMember | undefined;
	guild: Guild;
	channel: TextBasedChannel | undefined;

	constructor(id: Snowflake, base: Message | ChatInputCommandInteraction | StringSelectMenuInteraction | ButtonInteraction | null, guild: Guild | null = null) {
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
		if (base instanceof ChatInputCommandInteraction || base instanceof ButtonInteraction || base instanceof StringSelectMenuInteraction) this.user = base.user;
		else if (base) this.user = base.author;
		else this.user = client.user as User; //Dummy user
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

	async reply(message: string | MessagePayload | BaseMessageOptions): Promise<Message> {
		if (!this.base) throw new Error("Base not found");
		if (this.base instanceof ChatInputCommandInteraction || this.base instanceof ButtonInteraction || this.base instanceof StringSelectMenuInteraction) {
			return await this.base.editReply(message);
		} else {
			if (this.last) {
				return await this.last.edit(message);
			} else {
				return this.last = await this.base.reply(message);
			}
		}
	}

	asAuthor(): { name: string, iconURL: string } {
		return {name: this.user.tag, iconURL: this.user.displayAvatarURL()};
	}

	async getTotalData(): Promise<{ points: number, wins: number }> {
		return new Promise((resolve) => {
			resolve({points: 0, wins: 0});
		});
	}

	async getAllTimeEntryCount(): Promise<number> {
		return 0;
	}

	async deleteUser() {
		this.db.run("DELETE FROM global_points WHERE member = ?", [this.id]);
		this.db.run("DELETE FROM daily_points WHERE member = ?", [this.id]);
	}
}