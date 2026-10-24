import { describe, it, beforeEach, mock } from "node:test";
import assert from "node:assert/strict";
import { startServer, resetState, request, signupUser, createKey, wyze } from "./helpers.js";

const base = await startServer();
beforeEach(() => {
  resetState();
  mock.restoreAll();
  mock.method(wyze, "getObjectList", async () => ({ data: { device_list: [], device_group_list: [] } }));
});

describe("access to the data API", () => {
  it("leaves /healthz public", async () => {
    assert.deepEqual((await request(base, "/healthz")).body, { ok: true });
  });

  it("asks for a login without a session or key", async () => {
    const res = await request(base, "/api/cameras");
    assert.equal(res.status, 401);
    assert.deepEqual(res.body, { error: "Login required", code: "login_required" });
  });

  it("accepts the web's session", async () => {
    const cookie = await signupUser(base);
    assert.equal((await request(base, "/api/cameras", { cookie })).status, 200);
  });

  it("accepts a valid API key", async () => {
    const cookie = await signupUser(base);
    const { key } = await createKey(base, cookie);
    assert.equal((await request(base, "/api/cameras", { apiKey: key })).status, 200);
  });

  it("keeps API keys working after the web logs out", async () => {
    const cookie = await signupUser(base);
    const { key } = await createKey(base, cookie);
    await request(base, "/api/auth/logout", { method: "POST", cookie });
    assert.equal((await request(base, "/api/cameras", { cookie })).status, 401);
    assert.equal((await request(base, "/api/cameras", { apiKey: key })).status, 200);
  });

  it("rejects an invalid API key, even with a session", async () => {
    const cookie = await signupUser(base);
    const res = await request(base, "/api/cameras", { apiKey: "hc_nope", cookie });
    assert.equal(res.status, 401);
    assert.equal(res.body.code, "invalid_api_key");
  });

  it("protects unknown /api paths too", async () => {
    assert.equal((await request(base, "/api/nope")).status, 401);
  });
});
