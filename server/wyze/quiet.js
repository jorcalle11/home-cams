import Wyze from "wyze-api";
import { createRequire } from "node:module";
import crypto from "node:crypto";

// wyze-api logs the password hash to the console (and the hash works as a credential).
// Replace those functions on the shared module with silent versions.
// Import Wyze from here (not directly from "wyze-api") so the patch is always applied (see client.js).
const util = createRequire(import.meta.url)("wyze-api/src/util.js");
const md5 = (v) => crypto.createHash("md5").update(v).digest("hex");
util.createPassword = (password) => md5(md5(md5(password)));
const decrypt = util.wyzeDecrypt;
util.wyzeDecrypt = (...args) => {
  const log = console.log;
  console.log = () => {};
  try { return decrypt(...args); } finally { console.log = log; }
};
// wyze-api loads aws-sdk v2, which prints an end-of-support notice on startup. The notice is
// emitted on the next tick, so turning it off here (after the import) is enough.
createRequire(createRequire(import.meta.url).resolve("wyze-api"))("aws-sdk/lib/maintenance_mode_message").suppress = true;

export { Wyze };
