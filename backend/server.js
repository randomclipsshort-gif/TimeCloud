import "dotenv/config";
import { createServer } from "node:http";
import { createApp } from "./src/app.js";
import { getServerConfig } from "./src/config/config.js";

const port = Number.parseInt(process.env.PORT || "10000", 10);
if (!Number.isInteger(port) || port < 1 || port > 65_535) {
  throw new Error("PORT must be a valid TCP port.");
}

const config = getServerConfig();
const app = createApp({ config });
const server = createServer(app);

server.listen(port, "0.0.0.0", () => {
  console.log(`TimeCloud API listening on port ${port}.`);
});
