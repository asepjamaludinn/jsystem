import { describe, it, expect, vi, beforeEach } from "vitest";
import { controlJemuran } from "../src/controllers/deviceController.js";
import prisma from "../src/config/db.js";
import * as mqttService from "../src/services/mqttService.js";
import { JEMURAN_STATE } from "../src/utils/constants.js";

vi.mock("../src/config/db.js", () => ({
  default: {
    device: {
      update: vi.fn(),
      findUnique: vi.fn(),
    },
  },
}));

vi.mock("../src/services/mqttService.js", () => ({
  sendCommandWithDurationToDevice: vi.fn(),
}));

describe("Device Controller - Control Jemuran", () => {
  let req, res, next;

  beforeEach(() => {
    req = {
      params: { deviceId: "device-001" },
      body: {},
    };
    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };
    next = vi.fn();
    vi.clearAllMocks();
  });

  it(`Harus sukses mengirim perintah ${JEMURAN_STATE.KELUAR} dan update DB`, async () => {
    req.body.command = JEMURAN_STATE.KELUAR;

    prisma.device.findUnique.mockResolvedValue({
      id: "device-001",
      serialNumber: "SN-123",
    });

    // PERBAIKAN: Mengembalikan object yang sesuai dengan ekspektasi controller
    mqttService.sendCommandWithDurationToDevice.mockReturnValue({
      success: true,
      queued: false,
    });

    prisma.device.update.mockResolvedValue(true);

    await controlJemuran(req, res, next);

    expect(mqttService.sendCommandWithDurationToDevice).toHaveBeenCalledWith(
      "SN-123",
      { action: JEMURAN_STATE.KELUAR },
    );
    expect(prisma.device.update).toHaveBeenCalled();

    expect(res.json).toHaveBeenCalledWith({
      success: true,
      message: `Perintah ${JEMURAN_STATE.KELUAR} berhasil dikirim ke perangkat.`,
    });
  });

  it("Harus menolak jika command tidak valid (Status 400)", async () => {
    req.body.command = "TERBANG";

    await controlJemuran(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: expect.stringContaining("Perintah tidak valid!"),
      }),
    );
    expect(mqttService.sendCommandWithDurationToDevice).not.toHaveBeenCalled();
  });
});
