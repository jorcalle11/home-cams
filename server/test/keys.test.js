import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { startServer, resetState, request, signupUser, createKey, db } from "./helpers.js";

const base = await startServer();
let cookie;
beforeEach(async () => {
  resetState();
  cookie = await signupUser(base);
});

describe("/api/keys", () => {
  it("requires a session", async () => {
    const res = await request(base, "/api/keys");
    assert.equal(res.status, 401);
    assert.equal(res.body.code, "login_required");
  });

  it("can't be managed with an API key", async () => {
    const { key } = await createKey(base, cookie);
    assert.equal((await request(base, "/api/keys", { apiKey: key })).status, 401);
  });

  it("creates a key, returned only once and stored only as a hash", async () => {
    const res = await request(base, "/api/keys", { method: "POST", body: { name: "  LG TV  " }, cookie });
    assert.equal(res.status, 201);
    const { client, key } = res.body;
    assert.match(key, /^hc_[\w-]{32}$/);
    assert.equal(client.name, "LG TV");
    assert.equal(client.prefix, key.slice(0, 7));
    assert.equal(client.requests, 0);
    assert.equal(client.active, false);

    const row = db.prepare("SELECT * FROM clients").get();
    assert.notEqual(row.key_hash, key);
    const list = await request(base, "/api/keys", { cookie });
    assert.doesNotMatch(JSON.stringify(list.body), new RegExp(key));
  });

  it("requires a name", async () => {
    const res = await request(base, "/api/keys", { method: "POST", body: { name: " " }, cookie });
    assert.equal(res.status, 400);
  });

  it("lists clients with their latest use", async () => {
    const { key } = await createKey(base, cookie, "TV");
    await request(base, "/api/cameras/AA/stream", { apiKey: key }); // 400 (no model), but authenticated
    const { body } = await request(base, "/api/keys", { cookie });
    assert.equal(body.clients.length, 1);
    assert.equal(body.clients[0].name, "TV");
    assert.equal(body.clients[0].requests, 1);
    assert.equal(body.clients[0].active, true);
    assert.equal(body.clients[0].lastIp, "127.0.0.1");
  });

  it("revokes a key", async () => {
    const { client, key } = await createKey(base, cookie);
    assert.equal((await request(base, `/api/keys/${client.id}`, { method: "DELETE", cookie })).status, 204);
    assert.equal((await request(base, `/api/keys/${client.id}`, { method: "DELETE", cookie })).status, 404);
    const res = await request(base, "/api/cameras/AA/stream", { apiKey: key });
    assert.equal(res.status, 401);
  });
});
