import {BaseMessageOptions, ChatInputCommandInteraction, Client, Guild, Message, MessagePayload, TextBasedChannel, User} from "discord.js";

class BotInteraction {
    base: Message | ChatInputCommandInteraction;
    last: Message | undefined;
    user: User;
    guild: Guild;
    channel: TextBasedChannel;
    client: Client;

    constructor(base: Message | ChatInputCommandInteraction) {
        if (!base.guild) throw new Error("Guild not found");
        if (!base.channel) throw new Error("Channel not found");
        this.base = base;
        this.user = base instanceof ChatInputCommandInteraction ? base.user : base.author;
        this.guild = base.guild;
        this.channel = base.channel;
        this.client = base.client;
    }

    async reply(message: string | MessagePayload | BaseMessageOptions): Promise<Message> {
        if (this.base instanceof ChatInputCommandInteraction) {
            return await this.base.editReply(message);
        } else {
            if (this.last) {
                return await this.last.edit(message);
            } else {
                return this.last = await this.base.reply(message);
            }
        }
    }
}

export default BotInteraction;