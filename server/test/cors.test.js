import { describe, it } from "node:test";
import assert from "node:assert/strict";

// CORS_ORIGINS is read when the app is imported, so set it before the helpers load it.
process.env.CORS_ORIGINS = "http://tv.local, null";
const { startServer, request } = await import("./helpers.js");
const base = await startServer();

describe("CORS", () => {
  it("answers the preflight of an allowed origin before auth", async () => {
    const res = await request(base, "/api/cameras", { method: "OPTIONS", headers: { Origin: "http://tv.local" } });
    assert.equal(res.status, 204);
    assert.equal(res.headers.get("access-control-allow-origin"), "http://tv.local");
    assert.match(res.headers.get("access-control-allow-headers"), /Authorization/);
  });

  it("allows apps opened from file:// (origin null)", async () => {
    const res = await request(base, "/api/cameras", { method: "OPTIONS", headers: { Origin: "null" } });
    assert.equal(res.headers.get("access-control-allow-origin"), "null");
  });

  it("sends no CORS headers to other origins", async () => {
    const res = await request(base, "/api/cameras", { method: "OPTIONS", headers: { Origin: "http://evil.example" } });
    assert.equal(res.headers.get("access-control-allow-origin"), null);
  });
});
