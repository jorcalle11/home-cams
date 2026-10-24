import { Wyze } from "./quiet.js";
import { config } from "../config.js";

// The shared Wyze API client.
export const wyze = new Wyze({
  ...config.wyze,
  // Persist the token so every start doesn't log in again (Wyze rate-limits logins).
  persistPath: config.dataDir,
});
