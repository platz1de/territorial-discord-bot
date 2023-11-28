import {AttachmentBuilder, ChatInputCommandInteraction, SlashCommandBuilder} from "discord.js";
import {config, PointCommand} from "../PointManager";
import {createErrorEmbed} from "../util/EmbedUtil";
import {BotUserContext} from "../util/BotUserContext";
import {renderClanChart} from "../util/GraphRenderer";
import {parse} from "date-fns";

export default {
	slashData: new SlashCommandBuilder().setName("graph").setDescription("Request a clan graph")
		.addSubcommand(sub => sub.setName("alltime").setDescription("See the all-time graph")
			.addStringOption(option => option.setName("clan").setDescription("The clan to view").setRequired(true))
			.addBooleanOption(option => option.setName("dark").setDescription("Render on dark background"))
			.addStringOption(option => option.setName("clan2").setDescription("The clan to compare to"))
			.addStringOption(option => option.setName("clan3").setDescription("Additional clan"))
			.addStringOption(option => option.setName("clan4").setDescription("Additional clan"))
			.addStringOption(option => option.setName("clan5").setDescription("Additional clan"))
			.addStringOption(option => option.setName("clan6").setDescription("Additional clan"))
			.addStringOption(option => option.setName("clan7").setDescription("Additional clan"))
			.addStringOption(option => option.setName("clan8").setDescription("Additional clan"))
			.addStringOption(option => option.setName("clan9").setDescription("Additional clan"))
			.addStringOption(option => option.setName("clan10").setDescription("Additional clan"))
		)
		.addSubcommand(sub => sub.setName("month").setDescription("See the monthly graph")
			.addStringOption(option => option.setName("clan").setDescription("The clan to view").setRequired(true))
			.addBooleanOption(option => option.setName("dark").setDescription("Render on dark background"))
			.addStringOption(option => option.setName("clan2").setDescription("The clan to compare to"))
			.addStringOption(option => option.setName("clan3").setDescription("Additional clan"))
			.addStringOption(option => option.setName("clan4").setDescription("Additional clan"))
			.addStringOption(option => option.setName("clan5").setDescription("Additional clan"))
			.addStringOption(option => option.setName("clan6").setDescription("Additional clan"))
			.addStringOption(option => option.setName("clan7").setDescription("Additional clan"))
			.addStringOption(option => option.setName("clan8").setDescription("Additional clan"))
			.addStringOption(option => option.setName("clan9").setDescription("Additional clan"))
			.addStringOption(option => option.setName("clan10").setDescription("Additional clan"))
		)
		.addSubcommand(sub => sub.setName("week").setDescription("See the weekly graph")
			.addStringOption(option => option.setName("clan").setDescription("The clan to view").setRequired(true))
			.addBooleanOption(option => option.setName("dark").setDescription("Render on dark background"))
			.addStringOption(option => option.setName("clan2").setDescription("The clan to compare to"))
			.addStringOption(option => option.setName("clan3").setDescription("Additional clan"))
			.addStringOption(option => option.setName("clan4").setDescription("Additional clan"))
			.addStringOption(option => option.setName("clan5").setDescription("Additional clan"))
			.addStringOption(option => option.setName("clan6").setDescription("Additional clan"))
			.addStringOption(option => option.setName("clan7").setDescription("Additional clan"))
			.addStringOption(option => option.setName("clan8").setDescription("Additional clan"))
			.addStringOption(option => option.setName("clan9").setDescription("Additional clan"))
			.addStringOption(option => option.setName("clan10").setDescription("Additional clan"))
		)
		.addSubcommand(sub => sub.setName("custom").setDescription("See a custom timeframe graph")
			.addStringOption(option => option.setName("start").setDescription("The start date (DD-MM-YYYY)").setRequired(true))
			.addStringOption(option => option.setName("end").setDescription("The end date (DD-MM-YYYY)").setRequired(true))
			.addStringOption(option => option.setName("clan").setDescription("The clan to view").setRequired(true))
			.addStringOption(option => option.setName("start-hour").setDescription("The start hour (HH:MM)"))
			.addStringOption(option => option.setName("end-hour").setDescription("The end hour (HH:MM)"))
			.addBooleanOption(option => option.setName("dark").setDescription("Render on dark background"))
			.addStringOption(option => option.setName("clan2").setDescription("The clan to compare to"))
			.addStringOption(option => option.setName("clan3").setDescription("Additional clan"))
			.addStringOption(option => option.setName("clan4").setDescription("Additional clan"))
			.addStringOption(option => option.setName("clan5").setDescription("Additional clan"))
			.addStringOption(option => option.setName("clan6").setDescription("Additional clan"))
			.addStringOption(option => option.setName("clan7").setDescription("Additional clan"))
			.addStringOption(option => option.setName("clan8").setDescription("Additional clan"))
			.addStringOption(option => option.setName("clan9").setDescription("Additional clan"))
			.addStringOption(option => option.setName("clan10").setDescription("Additional clan"))
		),
	execute: async (context: BotUserContext) => {
		const interaction = context.base as ChatInputCommandInteraction;
		let clans: string[] = [interaction.options.getString("clan", true).toUpperCase()];
		for (let i = 0; i < 9; i++) {
			const clan = interaction.options.getString(`clan${i + 2}`);
			if (clan) {
				clans.push(clan.toUpperCase());
			}
		}
		let timeRequestString = "";
		switch (interaction.options.getSubcommand()) {
			case "alltime":
				break;
			case "month":
				timeRequestString = "&start=" + Math.floor(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).getTime() / 1000) + "&end=" + Math.floor(Date.now() / 1000);
				break;
			case "week":
				timeRequestString = "&start=" + Math.floor(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).getTime() / 1000) + "&end=" + Math.floor(Date.now() / 1000);
				break;
			case "custom":
				const start = interaction.options.getString("start", true);
				const end = interaction.options.getString("end", true);
				const startHour = interaction.options.getString("start-hour");
				const endHour = interaction.options.getString("end-hour");
				const startDate = parse(start, "dd-MM-yyyy", new Date());
				const endDate = parse(end, "dd-MM-yyyy", new Date());
				if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
					await context.reply(createErrorEmbed(context.user, "⚠ Invalid date format! Please use `DD-MM-YYYY`"));
					return;
				}
				if (startHour) {
					const startHourParts = startHour.split(":");
					if (startHourParts.length !== 2 || isNaN(parseInt(startHourParts[0])) || isNaN(parseInt(startHourParts[1]))) {
						await context.reply(createErrorEmbed(context.user, "⚠ Invalid start hour format! Please use `HH:MM`"));
						return;
					}
					startDate.setHours(parseInt(startHourParts[0]), parseInt(startHourParts[1]));
				} else {
					startDate.setHours(0, 0, 0, 0);
				}
				if (endHour) {
					const endHourParts = endHour.split(":");
					if (endHourParts.length !== 2 || isNaN(parseInt(endHourParts[0])) || isNaN(parseInt(endHourParts[1]))) {
						await context.reply(createErrorEmbed(context.user, "⚠ Invalid end hour format! Please use `HH:MM`"));
						return;
					}
					endDate.setHours(parseInt(endHourParts[0]), parseInt(endHourParts[1]));
				} else {
					endDate.setHours(23, 59, 59, 999);
				}
				if (startDate.getTime() > endDate.getTime()) {
					await context.reply(createErrorEmbed(context.user, "⚠ The start date must be before the end date!"));
					return;
				}
				timeRequestString = "&start=" + Math.floor(startDate.getTime() / 1000) + "&end=" + Math.floor(endDate.getTime() / 1000);
				break;
		}
		try {
			const buffer = await renderClanChart(await fetch(config.btt_api_url + "graph/?clan=" + clans.join(",") + timeRequestString).then(req => req.json()), interaction.options.getBoolean("dark") || false);
			await context.reply({
				files: [new AttachmentBuilder(buffer).setName("chart.png")]
			});
		} catch (e) {
			await context.reply("Failed to generate chart, please try again");
			console.error(e);
		}
	}
} as PointCommand;

