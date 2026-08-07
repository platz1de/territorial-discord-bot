import {createServer} from 'http';

export const server = createServer(function (r, s) {
	if (r.url === "/status/" && r.method === "GET") {
		s.writeHead(200, {"Content-Type": "application/text", "Access-Control-Allow-Origin": "*"});
		s.write("OK");
		s.end();
	} else {
		s.writeHead(405);
		s.write("Method not allowed");
		s.end();
	}
}).listen(34583);

console.log("Listening on port 34583");