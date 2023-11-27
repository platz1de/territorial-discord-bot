import {ChartJSNodeCanvas} from "chartjs-node-canvas";
import "chartjs-adapter-dayjs-3";

const width = 500;
const height = 300;

const canvasNormal = new ChartJSNodeCanvas({width, height, backgroundColour: "white"});
const canvasWide = new ChartJSNodeCanvas({width: 3 * width, height: 1.5 * height, backgroundColour: "white"});

export async function renderDualChart(data: { day: string, wins: number, points: number }[], title: string, wide: boolean): Promise<Buffer> {
	const config = {
		type: "line",
		data: {
			labels: data.map(d => d.day),
			datasets: [
				{label: "Points", data: data.map(d => d.points), yAxisID: "A", backgroundColor: "rgba(54, 162, 235, 0.5)", borderColor: "rgb(54, 162, 235)"},
				{label: "Wins", data: data.map(d => d.wins), yAxisID: "B", backgroundColor: "rgba(255, 159, 64, 0.5)", borderColor: "rgb(255, 159, 64)"}
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
	const canvas = wide ? canvasWide : canvasNormal;
	// @ts-ignore
	return await canvas.renderToBuffer(config);
}