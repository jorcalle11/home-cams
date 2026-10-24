import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { startServer, resetState, request, sessionCookie, signupUser, USER, db } from "./helpers.js";

const base = await startServer();
beforeEach(resetState);

const signup = (body) => request(base, "/api/auth/signup", { method: "POST", body });
const login = (body) => request(base, "/api/auth/login", { method: "POST", body });

describe("GET /api/auth/session", () => {
  it("asks for the signup on first run", async () => {
    const res = await request(base, "/api/auth/session");
    assert.deepEqual(res.body, { setupRequired: true, user: null });
  });

  it("asks for a login when there is a user but no session", async () => {
    await signupUser(base);
    const res = await request(base, "/api/auth/session");
    assert.deepEqual(res.body, { setupRequired: false, user: null });
  });

  it("returns the user with a valid session", async () => {
    const cookie = await signupUser(base);
    const res = await request(base, "/api/auth/session", { cookie });
    assert.deepEqual(res.body, { setupRequired: false, user: { username: USER.username } });
  });

  it("ignores an expired session", async () => {
    const cookie = await signupUser(base);
    db.exec("UPDATE sessions SET expires_at = 0");
    const res = await request(base, "/api/auth/session", { cookie });
    assert.equal(res.body.user, null);
  });
});

describe("POST /api/auth/signup", () => {
  it("registers the user and starts a session", async () => {
    const res = await signup(USER);
    assert.equal(res.status, 201);
    assert.deepEqual(res.body, { user: { username: USER.username } });
    const setCookie = res.headers.get("set-cookie");
    assert.match(setCookie, /^hc_session=[\w-]{43};/);
    assert.match(setCookie, /HttpOnly/);
    assert.match(setCookie, /SameSite=Lax/);
  });

  it("trims the username", async () => {
    const res = await signup({ ...USER, username: "  owner  " });
    assert.equal(res.body.user.username, "owner");
  });

  it("stores a scrypt hash, never the password", async () => {
    await signup(USER);
    const { password_hash } = db.prepare("SELECT password_hash FROM users").get();
    assert.doesNotMatch(password_hash, new RegExp(USER.password));
    assert.match(password_hash, /^[0-9a-f]{32}:[0-9a-f]{128}$/);
  });

  for (const [why, body] of [
    ["an empty username", { username: "  ", password: USER.password }],
    ["a username over 80 characters", { username: "a".repeat(81), password: USER.password }],
    ["a password under 8 characters", { username: "owner", password: "short" }],
    ["a password over 200 characters", { username: "owner", password: "a".repeat(201) }],
  ]) {
    it(`rejects ${why}`, async () => {
      const res = await signup(body);
      assert.equal(res.status, 400);
      assert.equal(db.prepare("SELECT count(*) AS n FROM users").get().n, 0);
    });
  }

  it("allows a single user", async () => {
    await signup(USER);
    const res = await signup({ username: "intruder", password: "another password" });
    assert.equal(res.status, 409);
    assert.equal(sessionCookie(res), null);
  });

  it("lets only one of two simultaneous signups win", async () => {
    const results = await Promise.all([signup(USER), signup({ username: "other", password: "other password" })]);
    assert.deepEqual(results.map((r) => r.status).sort(), [201, 409]);
  });
});

describe("POST /api/auth/login", () => {
  it("fails before the signup", async () => {
    assert.equal((await login(USER)).status, 401);
  });

  it("starts a session with the right credentials", async () => {
    await signupUser(base);
    const res = await login(USER);
    assert.equal(res.status, 200);
    assert.deepEqual(res.body, { user: { username: USER.username } });
    const session = await request(base, "/api/auth/session", { cookie: sessionCookie(res) });
    assert.equal(session.body.user.username, USER.username);
  });

  it("rejects a wrong password or username the same way", async () => {
    await signupUser(base);
    const wrongPassword = await login({ ...USER, password: "wrong password" });
    const wrongUsername = await login({ ...USER, username: "someone" });
    assert.equal(wrongPassword.status, 401);
    assert.deepEqual(wrongPassword.body, wrongUsername.body);
    assert.equal(sessionCookie(wrongPassword), null);
  });

  it("blocks the IP after 10 failures, even with the right password", async () => {
    await signupUser(base);
    for (let i = 0; i < 10; i++) await login({ ...USER, password: "wrong password" });
    const res = await login(USER);
    assert.equal(res.status, 429);
  });

  it("resets the failure count after a successful login", async () => {
    await signupUser(base);
    for (let i = 0; i < 9; i++) await login({ ...USER, password: "wrong password" });
    await login(USER);
    for (let i = 0; i < 9; i++) await login({ ...USER, password: "wrong password" });
    assert.equal((await login(USER)).status, 200);
  });
});

describe("POST /api/auth/logout", () => {
  it("ends the session on the server and clears the cookie", async () => {
    const cookie = await signupUser(base);
    const res = await request(base, "/api/auth/logout", { method: "POST", cookie });
    assert.equal(res.status, 204);
    assert.match(res.headers.get("set-cookie"), /^hc_session=;/);
    const session = await request(base, "/api/auth/session", { cookie });
    assert.equal(session.body.user, null);
  });

  it("works without a session", async () => {
    assert.equal((await request(base, "/api/auth/logout", { method: "POST" })).status, 204);
  });
});
