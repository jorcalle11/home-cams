import { config } from "./config.js";
import { createApp } from "./app.js";

const { host, port } = config;
if (!host || !port) {
  console.error("HOST and API_PORT must be set");
  process.exit(1);
}
createApp().listen(port, host, () => console.log(`API running on http://${host}:${port}`));
