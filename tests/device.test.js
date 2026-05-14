import { describe, it, expect, vi, beforeEach } from "vitest";
import { controlJemuran } from "../src/controllers/deviceController.js";
import prisma from "../src/config/db.js";
import * as mqttService from "../src/services/mqttService.js";

vi.mock("../src/config/db.js", () => ({
  default: {
    device: {
      update: vi.fn(),
    },
  },
}));

vi.mock("../src/services/mqttService.js", () => ({
  sendCommandToDevice: vi.fn(),
}));

describe("Device Controller - Control Jemuran", () => {
  let req, res;

  beforeEach(() => {
    req = {
      params: { deviceId: "device-001" },
      body: {},
    };
    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };
    vi.clearAllMocks();
  });

  it("Harus sukses mengirim perintah KELUAR dan update DB", async () => {
    req.body.command = "KELUAR";

    mqttService.sendCommandToDevice.mockReturnValue(true);
    prisma.device.update.mockResolvedValue(true);

    await controlJemuran(req, res);

    expect(mqttService.sendCommandToDevice).toHaveBeenCalledWith(
      "device-001",
      "KELUAR",
    );
    expect(prisma.device.update).toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({
      message: "Perintah KELUAR berhasil dikirim ke motor servo.",
    });
  });

  it("Harus menolak jika command tidak valid (Status 400)", async () => {
    req.body.command = "TERBANG";

    await controlJemuran(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: "Perintah tidak valid! Gunakan MASUK atau KELUAR.",
    });
    expect(mqttService.sendCommandToDevice).not.toHaveBeenCalled();
  });
});
