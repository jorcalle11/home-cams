// Slows down password guessing: after MAX_FAILURES failed logins from an IP, that IP can't try
// again until WINDOW_MS has passed since its first failure. In memory: a restart resets it.
const MAX_FAILURES = 10;
const WINDOW_MS = 15 * 60 * 1000;

const failures = new Map(); // ip -> { count, since }

export function isLimited(ip) {
  const f = failures.get(ip);
  if (f && Date.now() - f.since > WINDOW_MS) failures.delete(ip);
  return (failures.get(ip)?.count || 0) >= MAX_FAILURES;
}

export function recordFailure(ip) {
  const f = failures.get(ip) || { count: 0, since: Date.now() };
  failures.set(ip, { ...f, count: f.count + 1 });
}

export function clearFailures(ip) {
  failures.delete(ip);
}
