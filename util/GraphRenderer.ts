import {ChartJSNodeCanvas} from "chartjs-node-canvas";
import {TimeUnit} from "chart.js";
import {enGB} from "date-fns/locale";

const width = 500;
const height = 300;

const bgColors = ["rgba(54, 162, 235, 0.5)", "rgba(255, 159, 64, 0.5)", "rgba(75, 192, 192, 0.5)", "rgba(153, 102, 255, 0.5)", "rgba(255, 99, 132, 0.5)", "rgba(255, 205, 86, 0.5)", "rgba(201, 203, 207, 0.5)", "rgba(255, 99, 132, 0.5)", "rgba(54, 162, 235, 0.5)", "rgba(255, 159, 64, 0.5)"];
const borderColors = ["rgb(54, 162, 235)", "rgb(255, 159, 64)", "rgb(75, 192, 192)", "rgb(153, 102, 255)", "rgb(255, 99, 132)", "rgb(255, 205, 86)", "rgb(201, 203, 207)", "rgb(255, 99, 132)", "rgb(54, 162, 235)", "rgb(255, 159, 64)"];

let canvasNormal: ChartJSNodeCanvas;
let canvasWide: ChartJSNodeCanvas;
let darkCanvasWide: ChartJSNodeCanvas;

import("date-fns").then((fns) => {
	canvasNormal = new ChartJSNodeCanvas({
		width, height, backgroundColour: "white", chartCallback: (ChartJS) => {
			// @ts-ignore
			ChartJS._adapters._date.override(getDateAdapter(fns));
		}
	});
	canvasWide = new ChartJSNodeCanvas({
		width: 3 * width, height: 1.5 * height, backgroundColour: "white", chartCallback: (ChartJS) => {
			// @ts-ignore
			ChartJS._adapters._date.override(getDateAdapter(fns));
		}
	});
	darkCanvasWide = new ChartJSNodeCanvas({
		width: 3 * width, height: 1.5 * height, backgroundColour: "#212529", chartCallback: (ChartJS) => {
			// @ts-ignore
			ChartJS._adapters._date.override(getDateAdapter(fns));
		}
	});
});

export async function renderDualChart(data: { day: string, wins: number, points: number }[]): Promise<Buffer> {
	const config = {
		type: "line",
		data: {
			labels: data.map(d => d.day),
			datasets: [
				{label: "Points", data: data.map(d => d.points), yAxisID: "A", backgroundColor: bgColors[0], borderColor: borderColors[0]},
				{label: "Wins", data: data.map(d => d.wins), yAxisID: "B", backgroundColor: bgColors[1], borderColor: borderColors[1]}
			]
		},
		options: {
			scales: {
				A: {
					type: "linear",
					display: true,
					position: "left"
				},
				B: {
					type: "linear",
					display: true,
					position: "right",
					grid: {
						drawOnChartArea: false
					}
				}
			}
		}
	};
	// @ts-ignore
	return await canvasNormal.renderToBuffer(config);
}

export async function renderClanChart(data: { label: number, score: number, line: string }[], dark: boolean): Promise<Buffer> {
	let lineData: { label: string, data: { x: number, y: number }[], backgroundColor: string, borderColor: string }[] = [];
	for (const entry of data) {
		let clan = entry.line;
		let clanData = lineData.find((data) => data.label === clan);
		if (!clanData) {
			clanData = {
				label: clan,
				data: [],
				backgroundColor: bgColors[lineData.length % bgColors.length],
				borderColor: borderColors[lineData.length % borderColors.length]
			};
			lineData.push(clanData);
		}
		clanData.data.push({
			x: entry.label,
			y: entry.score
		});
	}
	const config = {
		type: "line",
		data: {
			datasets: lineData
		},
		options: {
			scales: {
				x: {
					type: "time",
					time: {
						displayFormats: {
							second: "HH:mm:ss",
							minute: "HH:mm",
							hour: "HH:mm",
							day: "dd.MM.yy",
							week: "dd.MM.yy",
							month: "MMMM yy",
							quarter: "MMMM yy"
						}
					}
				},
				y: {
					title: {
						display: true,
						text: "Score"
					},
					ticks: {
						callback: function (value: number) {
							return value / 10000
						}
					}
				}
			},
			plugins: {
				title: {
					display: true,
					text: "Clan score over time",
					font: {
						size: 24
					}
				},
				subtitle: {
					display: true,
					text: " ~ BetterTT by @platz1de",
					position: "bottom",
					align: "end"
				}
			},
			elements: {
				point: {
					radius: 0
				}
			}
		}
	};
	const canvas = dark ? darkCanvasWide : canvasWide;
	// @ts-ignore
	return await canvas.renderToBuffer(config);
}

function getDateAdapter(fns: typeof import("date-fns")) {
	return {
		formats: () => {
			return {
				second: "HH:mm:ss",
				minute: "HH:mm",
				hour: "HH:mm",
				day: "dd.MM.yy",
				week: "dd.MM.yy",
				month: "MMMM yy",
				quarter: "MMMM yy"
			}
		},
		parse: function (value: string) {
			let date = fns.parseISO(value);
			return fns.isValid(date) ? date.getTime() : null;
		},
		format: function (timestamp: number, unit: TimeUnit) {
			return fns.format(timestamp, unit, {locale: enGB});
		},
		add: function (time: number, amount: number, unit: TimeUnit) {
			switch (unit) {
				case "millisecond":
					return fns.addMilliseconds(time, amount);
				case "second":
					return fns.addSeconds(time, amount);
				case "minute":
					return fns.addMinutes(time, amount);
				case "hour":
					return fns.addHours(time, amount);
				case "day":
					return fns.addDays(time, amount);
				case "week":
					return fns.addWeeks(time, amount);
				case "month":
					return fns.addMonths(time, amount);
				case "quarter":
					return fns.addQuarters(time, amount);
				case "year":
					return fns.addYears(time, amount);
				default:
					return time;
			}
		},
		diff: function (a: number, b: number, unit: TimeUnit) {
			switch (unit) {
				case "millisecond":
					return fns.differenceInMilliseconds(a, b);
				case "second":
					return fns.differenceInSeconds(a, b);
				case "minute":
					return fns.differenceInMinutes(a, b);
				case "hour":
					return fns.differenceInHours(a, b);
				case "day":
					return fns.differenceInDays(a, b);
				case "week":
					return fns.differenceInWeeks(a, b);
				case "month":
					return fns.differenceInMonths(a, b);
				case "quarter":
					return fns.differenceInQuarters(a, b);
				case "year":
					return fns.differenceInYears(a, b);
				default:
					return 0;
			}
		},
		startOf: function (timestamp: number, unit: TimeUnit | "isoWeek", weekday?: 0 | 1 | 2 | 3 | 4 | 5 | 6 | undefined) {
			switch (unit) {
				case "second":
					return fns.startOfSecond(timestamp);
				case "minute":
					return fns.startOfMinute(timestamp);
				case "hour":
					return fns.startOfHour(timestamp);
				case "day":
					return fns.startOfDay(timestamp);
				case "week":
					return fns.startOfWeek(timestamp);
				case "isoWeek":
					return fns.startOfWeek(timestamp, {weekStartsOn: weekday});
				case "month":
					return fns.startOfMonth(timestamp);
				case "quarter":
					return fns.startOfQuarter(timestamp);
				case "year":
					return fns.startOfYear(timestamp);
				default:
					return timestamp;
			}
		},
		endOf: function (timestamp: number, unit: TimeUnit | "isoWeek") {
			switch (unit) {
				case "second":
					return fns.endOfSecond(timestamp);
				case "minute":
					return fns.endOfMinute(timestamp);
				case "hour":
					return fns.endOfHour(timestamp);
				case "day":
					return fns.endOfDay(timestamp);
				case "week":
					return fns.endOfWeek(timestamp);
				case "month":
					return fns.endOfMonth(timestamp);
				case "quarter":
					return fns.endOfQuarter(timestamp);
				case "year":
					return fns.endOfYear(timestamp);
				default:
					return timestamp;
			}
		}
	}
}