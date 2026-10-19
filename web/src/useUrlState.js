import { useCallback, useEffect, useState } from "react";

// State synced with the query string (?tab=events&group=Casa&day=2026-10-18).
// Changes push a history entry, so the browser's back/forward buttons work.
const read = () => Object.fromEntries(new URLSearchParams(window.location.search));

export function useUrlState() {
  const [params, setParams] = useState(read);

  useEffect(() => {
    const onPop = () => setParams(read());
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  // update({ day: "2026-10-18", cam: null }) — null or "" removes the parameter.
  const update = useCallback((changes) => {
    const q = new URLSearchParams(window.location.search);
    for (const [k, v] of Object.entries(changes)) {
      if (v == null || v === "") q.delete(k);
      else q.set(k, v);
    }
    const search = q.toString();
    const url = `${window.location.pathname}${search ? `?${search}` : ""}`;
    if (url !== window.location.pathname + window.location.search) window.history.pushState(null, "", url);
    setParams(read());
  }, []);

  // Go back home (no parameters). Does nothing if already home.
  const reset = useCallback(() => {
    if (!window.location.search) return;
    window.history.pushState(null, "", window.location.pathname);
    setParams({});
  }, []);

  return [params, update, reset];
}
