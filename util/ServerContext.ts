import {ColorResolvable, EmbedBuilder, Guild, GuildMember, Message, TextChannel, User} from "discord.js";
import {getServerContext, type MultiplierSetting, ServerSetting, updateSettings} from "../BotSettingProvider.js";
import {InteractionTypes} from "./BaseUserContext.js";

export type LimitedServerSettings = Omit<ServerSetting, "multiplier">;

export class ServerContext {
	readonly guild: Guild;
	private readonly settings: ServerSetting;

	constructor(guild: Guild, settings: ServerSetting) {
		this.guild = guild;
		this.settings = settings;
	}

	// TODO: remove undefined and null from this signature
	hasModAccess(interaction: InteractionTypes | Message): boolean {
		if (!interaction.member || !(interaction.member instanceof GuildMember)) return false;
		for (const role of interaction.member.roles.cache.values() || []) {
			if (this.settings.mod_roles.includes(role.id)) {
				return true;
			}
		}
		return false;
	}

	// TODO: Replace usages of this with utility methods that handle the logic
	getSettings(): LimitedServerSettings {
		return this.settings;
	}

	getActiveMultiplier(): MultiplierSetting | null {
		if (this.settings.multiplier === null) return null;
		if (this.settings.multiplier.end !== null && this.settings.multiplier.end < Date.now()) {
			this.settings.multiplier = null;
			updateSettings();
		}
		return this.settings.multiplier;
	}

	setMultiplier(multiplier: MultiplierSetting) {
		this.settings.multiplier = multiplier;
		updateSettings();
	}

	clearMultiplier() {
		this.settings.multiplier = null;
		updateSettings();
	}

	logAction(user: User, action: string, color: ColorResolvable) {
		const channel = this.guild.channels.cache.get(this.settings.log_channel_id);
		if (!(channel instanceof TextChannel)) return;
		channel.send({
			embeds: [
				new EmbedBuilder().setAuthor({name: user.tag, iconURL: user.displayAvatarURL()})
					.setDescription(action).setColor(color).setTimestamp().toJSON()
			]
		}).catch(console.error);
	}
}

export function createServerContext(guild: Guild | null): ServerContext | null {
	if (!guild) return null;
	const settings = getServerContext(guild.id);
	if (!settings) return null;
	return new ServerContext(guild, settings);
}