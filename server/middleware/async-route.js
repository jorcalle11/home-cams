// Wraps an async handler (most call Wyze): a failure becomes a 502 with a trimmed message.
// Trimmed because some wyze-api errors include signed URLs and TURN credentials.
export const asyncRoute = (fn) => (req, res) =>
  fn(req, res).catch((err) => {
    const msg = (err.response?.data?.description || err.message).split(":")[0].slice(0, 200);
    console.error(`[${req.method} ${req.originalUrl.split("?")[0]}]`, msg);
    res.status(502).json({ error: msg });
  });
