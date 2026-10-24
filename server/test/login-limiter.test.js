import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createLoginLimiter } from "../features/auth/login-limiter.js";

describe("createLoginLimiter", () => {
  const setup = () => {
    let time = 0;
    const limiter = createLoginLimiter({ max: 3, windowMs: 1000, now: () => time });
    return { limiter, advance: (ms) => (time += ms) };
  };

  it("limits an IP after `max` failures", () => {
    const { limiter } = setup();
    for (let i = 0; i < 2; i++) limiter.recordFailure("1.1.1.1");
    assert.equal(limiter.isLimited("1.1.1.1"), false);
    limiter.recordFailure("1.1.1.1");
    assert.equal(limiter.isLimited("1.1.1.1"), true);
  });

  it("counts each IP separately", () => {
    const { limiter } = setup();
    for (let i = 0; i < 3; i++) limiter.recordFailure("1.1.1.1");
    assert.equal(limiter.isLimited("2.2.2.2"), false);
  });

  it("lifts the limit once the window since the first failure has passed", () => {
    const { limiter, advance } = setup();
    for (let i = 0; i < 3; i++) limiter.recordFailure("1.1.1.1");
    advance(1000);
    assert.equal(limiter.isLimited("1.1.1.1"), true);
    advance(1);
    assert.equal(limiter.isLimited("1.1.1.1"), false);
  });

  it("forgets an IP's failures when cleared", () => {
    const { limiter } = setup();
    for (let i = 0; i < 3; i++) limiter.recordFailure("1.1.1.1");
    limiter.clearFailures("1.1.1.1");
    assert.equal(limiter.isLimited("1.1.1.1"), false);
  });
});
