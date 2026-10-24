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

const camera = (mac, extra = {}) => ({
  mac,
  product_type: "Camera",
  product_model: "HL_CAM4",
  nickname: `Cam ${mac}`,
  conn_state: 1,
  firmware_ver: "4.52.9",
  device_params: { power_switch: 1, ip: "192.168.1.10", camera_thumbnails: [{ url: "https://thumb" }] },
  ...extra,
});

describe("GET /api/cameras", () => {
  it("returns the cameras and the groups that contain them", async () => {
    mock.method(wyze, "getObjectList", async () => ({
      data: {
        device_list: [
          camera("AA"),
          camera("BB", { conn_state: 0, device_params: { power_switch: 0 } }),
          { mac: "PLUG", product_type: "Plug" },
        ],
        device_group_list: [
          { group_id: 7, group_name: "Casa", device_list: [{ device_mac: "AA" }, { device_mac: "PLUG" }] },
          { group_id: 8, group_name: "Plugs", device_list: [{ device_mac: "PLUG" }] },
        ],
      },
    }));
    const { status, body } = await request(base, "/api/cameras", { cookie });
    assert.equal(status, 200);
    assert.deepEqual(body.cameras, [
      { mac: "AA", model: "HL_CAM4", name: "Cam AA", online: true, on: true, thumbnail: "https://thumb", firmware: "4.52.9", ip: "192.168.1.10" },
      { mac: "BB", model: "HL_CAM4", name: "Cam BB", online: false, on: false, thumbnail: null, firmware: "4.52.9", ip: null },
    ]);
    assert.deepEqual(body.groups, [{ id: "7", name: "Casa", macs: ["AA"] }]);
  });

  it("answers 502 with a trimmed message when Wyze fails", async () => {
    mock.method(wyze, "getObjectList", async () => {
      throw new Error("Request failed: https://signed.example/?X-Amz-Signature=secret");
    });
    const res = await request(base, "/api/cameras", { cookie });
    assert.equal(res.status, 502);
    assert.deepEqual(res.body, { error: "Request failed" });
  });
});

describe("GET /api/cameras/:mac/stream", () => {
  it("requires the model", async () => {
    assert.equal((await request(base, "/api/cameras/AA/stream", { cookie })).status, 400);
  });

  it("returns Wyze's WebRTC connection info", async () => {
    const getInfo = mock.method(wyze, "getCameraWebRTCConnectionInfo", async () => ({ signalingUrl: "wss://x", iceServers: [] }));
    const res = await request(base, "/api/cameras/AA/stream?model=HL_CAM4&substream=true", { cookie });
    assert.deepEqual(res.body, { signalingUrl: "wss://x", iceServers: [] });
    assert.deepEqual(getInfo.mock.calls[0].arguments, ["AA", "HL_CAM4", { substream: true, noCache: true }]);
  });
});

describe("POST /api/cameras/:mac/power", () => {
  for (const body of [{}, { model: "HL_CAM4" }, { model: "HL_CAM4", on: "yes" }]) {
    it(`rejects ${JSON.stringify(body)}`, async () => {
      const res = await request(base, "/api/cameras/AA/power", { method: "POST", body, cookie });
      assert.equal(res.status, 400);
    });
  }

  it("turns the camera on or off", async () => {
    const run = mock.method(wyze, "runAction", async () => ({ code: "1" }));
    const res = await request(base, "/api/cameras/AA/power", { method: "POST", body: { model: "HL_CAM4", on: false }, cookie });
    assert.deepEqual(res.body, { on: false });
    assert.deepEqual(run.mock.calls[0].arguments, ["AA", "HL_CAM4", "power_off"]);
  });

  it("answers 502 when Wyze rejects the change", async () => {
    mock.method(wyze, "runAction", async () => ({ code: "2001", msg: "Device offline" }));
    const res = await request(base, "/api/cameras/AA/power", { method: "POST", body: { model: "HL_CAM4", on: true }, cookie });
    assert.equal(res.status, 502);
    assert.equal(res.body.error, "Wyze rejected the change (2001 Device offline)");
  });
});
