import {server} from "./APIServer.js";
import {WebSocketServer} from "ws";
import {config} from "../PointManager.js";
import {addToCache} from "./GameDataDistributor.js";

const wss = new WebSocketServer({server});
wss.on("connection", function (ws) {
	ws.onmessage = function (message) {
		const msg = message.data.toString();
		if (msg.length > 1024) {
			ws.terminate();
			return;
		}
		let data: { [key: string]: any };
		try {
			data = JSON.parse(msg);
		} catch (e) {
			ws.terminate();
			return;
		}
		if (data.type === "verification" && typeof data.secret === "string" && data.secret === config.wss_secret) {
			console.log("Verification Client connected");
			ws.onmessage = function (message) {
				addToCache(message.data.toString());
			}
		} else {
			ws.terminate();
		}
	}
});
