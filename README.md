# Territorial Point System

Simple point management system for Territorial.io-related clan servers.

Public hosted version: [invite](https://discord.com/api/oauth2/authorize?client_id=1129748745530114049&permissions=268435456&scope=bot%20applications.commands)

## Installation

1. Clone the repository
2. Install dependencies with `npm install`
3. Install TypeScript globally with `npm install -g typescript` (if not already installed)
4. Compile the bot with `tsc`
5. Paste your bot token in `build/config.json` (Obtainable from [here](https://discord.com/developers/applications).
Set `wss_secret` (can be left blank in development environemnt). Other options can be left blank for basic functionality to work.
6. Run the bot with `cd build && node PointManager`

## Usage

1. Invite bot to your server
2. Run the `/setup` command and complete the setup process.
3. Run `/settings settag` to set clan tag e.g. `[TEST]`.
4. A list of commands can be found by running `/help` in your Discord server.

## Win Feed
To trigger win registration logic:

1. Open your Browser
2. Navigate to http://localhost:34583/
3. Open Dev Tools
4. Open Console
5. Establish socket connection (`secret` should match `wss_secret`):
```
let ws = new WebSocket('ws://localhost:34583');
ws.onopen = (event) => {
	ws.send(JSON.stringify({ type: 'verification', secret: '' }));
};
```
6. Post a win message:
```
payload = { data: `\`\`\`
Time:          Fri, 29 Jul 2026 07:21:41 GMT
Contest:       No
Map:           World 2
Player Count:  45
Winning Clan:  [TEST]
Prev. Points:  11.47881
Gain:          4.06902
Curr. Points:  15.54775
Payout:        brqB7 17.49, rtbrT 9.08, tLDCT 5.33, vmFeL 4.32, FW51c 1.78
Clan Winners:  mvnV5, rtbrT\`\`\`` };
ws.send(JSON.stringify(payload));
```

Win messages should be in the same format as posted on Territorial.IO [-log-team](https://discord.com/channels/780723109128962070/917537295261913159) channel.