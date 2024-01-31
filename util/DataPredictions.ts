let clans: { tag: string, score: string }[] = [];
let players: { name: string, score: string, games: string }[] = [];

let lastUpdate = "";

setInterval(checkData, 5 * 60 * 1000); //5 minutes
checkData();

function checkData() {
	fetch("https://territorial.io/clans").then(r => r.text()).then(r => {
		const data = r.split("\n");
		const changeDate = data[0].substring(17);
		if (lastUpdate === changeDate) return;
		clans = [];
		for (let i = 6; i < data.length; i++) {
			const entry = data[i].split(", ");
			if (entry.length < 3) continue;
			clans.push({
				tag: entry.slice(1, entry.length - 1).join(", "),
				score: entry[entry.length - 1]
			});
		}
		lastUpdate = changeDate;
		fetch("https://territorial.io/players").then(r => r.text()).then(r => {
			const data = r.split("\n");
			players = [];
			for (let i = 6; i < data.length; i++) {
				const entry = data[i].split(", ");
				if (entry.length < 4) continue;
				players.push({
					name: entry.slice(1, entry.length - 2).join(", "),
					score: entry[entry.length - 2],
					games: entry[entry.length - 1]
				});
			}
		}).catch(() => {});
	}).catch(() => {});
}

export function setClanScore(clan: string, score: string) {
	for (let i = 0; i < clans.length; i++) {
		if (clans[i].tag === clan) {
			clans[i].score = score;
			updateIndex(i, clans);
			return;
		}
	}
	clans.push({tag: clan, score: score});
	updateIndex(clans.length - 1, clans);
}

export function tryHandlePlayerData(data: string) {
	let match = data.match(/^\*?\*?(.*)\s\[(\d+)\.(\d)]\swon\sagainst\s(.*)\s\[(\d+)\.(\d)]\.\*?\*?$/);
	if (!match) return;
	tryUpdatePlayer(match[1], match[2] + "." + match[3], true);
	tryUpdatePlayer(match[4], match[5] + "." + match[6], false);
}

export function tryUpdatePlayer(player: string, score: string, isWin: boolean) {
	let value = parseFloat(score);
	for (let i = 0; i < players.length; i++) {
		if (players[i].name === player) {
			let oldScore = parseFloat(players[i].score);
			if ((isWin === oldScore < value) && isWin ? value - oldScore < 0.1 * oldScore : oldScore - value < 0.1 * oldScore) {
				players[i].score = score;
				players[i].games = (parseInt(players[i].games) + 1).toString();
				updateIndex(i, players);
				return;
			}
		}
	}
}

export function getTTPlayerLeaderboard(page: number, query: string): { entries: [string, string, string, string][], total: number } {
	let filtered = players.map((player, index) => ({player, index})).filter(({player}) => player.name.toLowerCase().includes(query));
	let total = filtered.length;
	filtered = filtered.slice((page - 1) * 100, page * 100);
	return {
		entries: filtered.map(({player, index}) => [(index + 1).toString(), player.name, player.score, player.games]),
		total: total
	};
}

export function getTTClanLeaderboard(page: number, query: string): { entries: [string, string, string][], total: number } {
	let filtered = clans.map((clan, index) => ({clan, index})).filter(({clan}) => clan.tag.toLowerCase().includes(query));
	let total = filtered.length;
	filtered = filtered.slice((page - 1) * 100, page * 100);
	return {
		entries: filtered.map(({clan, index}) => [(index + 1).toString(), clan.tag, clan.score]),
		total: total
	};
}

function updateIndex(index: number, data: { score: string }[]) {
	const element = data[index];
	data.splice(index, 1);
	let score = parseFloat(element.score);

	let low = 0, high = data.length;

	while (low < high) {
		let mid = (low + high) >>> 1;
		if (parseFloat(data[mid].score) < score) {
			high = mid;
		} else {
			low = mid + 1;
		}
	}

	data.splice(low, 0, element);
}
