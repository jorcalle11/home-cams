// The session cookie: HttpOnly (scripts can't read it), SameSite=Lax (not sent on cross-site
// POSTs) and Secure when the request came over HTTPS (directly or through the proxy).
const NAME = "hc_session";

export function readSessionToken(req) {
  const cookie = (req.headers.cookie || "").split(";").map((c) => c.trim()).find((c) => c.startsWith(`${NAME}=`));
  return cookie ? decodeURIComponent(cookie.slice(NAME.length + 1)) : null;
}

export function setSessionCookie(req, res, { token, maxAge }) {
  res.cookie(NAME, token, { httpOnly: true, sameSite: "lax", secure: req.secure, path: "/", maxAge });
}

export function clearSessionCookie(req, res) {
  res.clearCookie(NAME, { httpOnly: true, sameSite: "lax", secure: req.secure, path: "/" });
}
