// Slows down password guessing: after `max` failed logins from an IP, that IP can't try again
// until `windowMs` has passed since its first failure. In memory: a restart resets it.
export function createLoginLimiter({ max = 10, windowMs = 15 * 60 * 1000, now = Date.now } = {}) {
  const failures = new Map(); // ip -> { count, since }

  return {
    isLimited(ip) {
      const f = failures.get(ip);
      if (f && now() - f.since > windowMs) failures.delete(ip);
      return (failures.get(ip)?.count || 0) >= max;
    },
    recordFailure(ip) {
      const f = failures.get(ip) || { count: 0, since: now() };
      failures.set(ip, { ...f, count: f.count + 1 });
    },
    clearFailures(ip) {
      failures.delete(ip);
    },
    reset() {
      failures.clear();
    },
  };
}

export const loginLimiter = createLoginLimiter();
