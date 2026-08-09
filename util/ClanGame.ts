/*
Use https://regex101.com/ to test regex against a sample message

Sample message:

```
Time:          Sat, 01 Aug 2026 08:03:01 GMT
Contest:       No
Map:           British Isles
Player Count:  31
Winning Clan:  [TEST]
Prev. Points: 18.29580
Gain:          0.03906
Curr. Points: 18.33189
Payout:        WL5nq 17.43, 5RQRt 5.43, RrmVM 3.61, t88B5 1.23, cdn5W 0.30
Clan Winners:  t88B5
```

*/

export interface GoldPayout {
	player: string,
	gold: number
}

export class ClanGame {
	private static readonly regexClanWin = /^```\sTime:\s{10}(?<time>[^\n]+)\sContest:\s{7}(?<contest>Yes|No)\sMap:\s{11}(?<map>[^\n]+)\sPlayer Count:\s{2}(?<playercount>\d+)\sWinning\sClan:\s{2}\[(?<clan>.*)]\sPrev.\sPoints:\s{1,2}(?<prevpoints>[\d.]+)\sGain:\s{10}(?<gainpoints>[\d.]+)\sCurr.\sPoints:\s{1,2}(?<currpoints>[\d.]+)\sPayout:\s{8}(?<payout>[^\n]+)\sClan Winners:\s{2}(?<clanwinners>[^\n]+)```$/;
	readonly timeCompleted: Date = new Date( Date.now());
	readonly clan: string = "";
	readonly prevClanPoints: number = 0;
	readonly gainPoints: number = 0;
	readonly currClanPoints: number = 0;
	readonly map: string = "";
	readonly playerCount: number = 0;
	readonly contest: boolean = false;
	readonly clanWinners: readonly string[] = [];
	readonly goldPayout: readonly GoldPayout[] = []; //this implies a list of surviving players in the winning team (including clan winners)
	readonly timestamp: number = 0.
	readonly isDefault: boolean = true;
	
	//Parse Game Result from string
    constructor( message: string )
    {
		//Check for a Clan Win; Note: non-clan wins will fail a match as message format is different.
		let match = message.match(ClanGame.regexClanWin);
		
		//Return default object where .timestamp = 0 indicates that parsing has failed
		if (!match || !match.groups) return;
	
		this.timeCompleted = new Date(match.groups.time);
		this.contest = match.groups.contest === "Yes";
		this.map = match.groups.map;
		this.playerCount = parseInt(match.groups.playercount);
		this.clan = match.groups.clan;
		this.prevClanPoints = Number(match.groups.prevpoints);
		this.gainPoints = Number(match.groups.gainpoints);
		this.currClanPoints = Number(match.groups.currpoints);
		this.clanWinners = match.groups.clanwinners.split(", ");
		this.goldPayout = match.groups.payout.split(", ").map(( payout:string) =>
				{
					const payoutVals = payout.split( " " );
					return {
						player: payoutVals[0],
						gold: Number( payoutVals[1] )
					};
				}) as readonly GoldPayout[];
		this.timestamp = new Date(match.groups.time).getTime();
		this.isDefault = false;
    }
}