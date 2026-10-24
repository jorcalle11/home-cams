import { describe, it, before, beforeEach, mock } from "node:test";
import assert from "node:assert/strict";
import { startServer, resetState, request, signupUser, wyze } from "./helpers.js";

const base = await startServer();
let cookie;
before(async () => {
  resetState();
  cookie = await signupUser(base);
});
beforeEach(() => mock.restoreAll());

const event = (ts, extra = {}) => ({
  event_id: `e${ts}`,
  device_mac: "AA",
  device_model: "HL_CAM4",
  event_ts: ts,
  event_value: "1",
  tag_list: [],
  file_list: [],
  ...extra,
});
// Wyze wraps the list: { data: { data: { event_list, next_page } } }
const page = (list, nextPage = 0) => ({ data: { data: { event_list: list, next_page: nextPage } } });

describe("GET /api/events", () => {
  it("maps Wyze's events, with Spanish labels for the UI", async () => {
    mock.method(wyze, "request", async () =>
      page([
        event(1000, {
          event_value: "2",
          tag_list: [101],
          file_list: [
            { type: 1, url: "https://img", ai_tag_list: [102, 101] },
            { type: 2, url: "https://video" },
          ],
        }),
        event(900, { event_value: "9", tag_list: [999] }),
      ]),
    );
    const { body } = await request(base, "/api/events?begin=0&end=2000", { cookie });
    assert.deepEqual(body, {
      events: [
        { id: "e1000", mac: "AA", model: "HL_CAM4", ts: 1000, type: "Sonido", tags: ["Persona", "Vehículo"], image: "https://img", video: "https://video" },
        { id: "e900", mac: "AA", model: "HL_CAM4", ts: 900, type: "Evento 9", tags: ["999"], image: null, video: null },
      ],
      next: null,
    });
  });

  it("filters by camera and defaults to the 24 hours before `end`", async () => {
    const call = mock.method(wyze, "request", async () => page([]));
    await request(base, "/api/events?end=100000000&mac=AA&mac=BB", { cookie });
    const [endpoint, params] = call.mock.calls[0].arguments;
    assert.equal(endpoint, "app/v2/device/get_event_list");
    assert.deepEqual(params.device_mac_list, ["AA", "BB"]);
    assert.equal(params.begin_time, 100000000 - 24 * 60 * 60 * 1000);
    assert.equal(params.end_time, 100000000);
  });

  it("follows up to 3 pages and returns where to continue", async () => {
    let ts = 10000;
    const call = mock.method(wyze, "request", async () => page([event(ts--), event(ts--)], 1));
    const { body } = await request(base, "/api/events?begin=0&end=20000", { cookie });
    assert.equal(call.mock.callCount(), 3);
    assert.equal(body.events.length, 6);
    // Each page starts just before the previous page's last event.
    assert.deepEqual(call.mock.calls.map((c) => c.arguments[1].end_time), [20000, 9998, 9996]);
    assert.equal(body.next, 9994);
  });

  it("stops when Wyze has no more pages", async () => {
    const call = mock.method(wyze, "request", async () => page([event(1000)], 0));
    const { body } = await request(base, "/api/events?begin=0&end=2000", { cookie });
    assert.equal(call.mock.callCount(), 1);
    assert.equal(body.next, null);
  });
});
