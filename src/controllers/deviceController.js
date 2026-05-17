import prisma from "../config/db.js";
import { sendCommandWithDurationToDevice } from "../services/mqttService.js";
import { fetchWeatherByCity } from "../services/weatherService.js";
import { JEMURAN_STATE, NIGHT_MODE_STATE } from "../utils/constants.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const getMyDevices = asyncHandler(async (req, res) => {
  const devices = await prisma.device.findMany({
    where: {
      users: { some: { id: req.user.userId } },
    },
    include: {
      _count: { select: { notifications: { where: { isRead: false } } } },
    },
  });

  res.json({
    success: true,
    message: "Daftar perangkat berhasil diambil",
    data: devices,
  });
});

export const claimDevice = asyncHandler(async (req, res) => {
  const { serialNumber, name, locationCity } = req.body;
  const userId = req.user.userId;

  let device = await prisma.device.findUnique({
    where: { serialNumber },
  });

  if (device) {
    device = await prisma.device.update({
      where: { serialNumber },
      data: {
        users: { connect: { id: userId } },
      },
    });
    return res.status(200).json({
      success: true,
      message: "Berhasil tersambung ke alat keluarga!",
      data: { isShared: true, device },
    });
  }

  device = await prisma.device.create({
    data: {
      serialNumber,
      name,
      locationCity,
      users: { connect: { id: userId } },
    },
  });

  res.status(201).json({
    success: true,
    message: "Alat baru berhasil didaftarkan!",
    data: { isShared: false, device },
  });
});

export const getDeviceLogs = asyncHandler(async (req, res) => {
  const { deviceId } = req.params;
  const logs = await prisma.sensorLog.findMany({
    where: { deviceId },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  if (!logs || logs.length === 0) {
    return res.json({
      success: true,
      message: "Log perangkat kosong",
      data: [],
    });
  }

  res.json({
    success: true,
    message: "Log berhasil diambil",
    data: logs,
  });
});

export const deleteDeviceLog = asyncHandler(async (req, res) => {
  const { logId } = req.params;

  await prisma.sensorLog.delete({
    where: { id: logId },
  });

  res.json({
    success: true,
    message: "Riwayat aktivitas berhasil dihapus.",
  });
});

export const getDeviceNotifications = asyncHandler(async (req, res) => {
  const { deviceId } = req.params;
  const notifications = await prisma.notification.findMany({
    where: { deviceId },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  res.json({
    success: true,
    message: "Notifikasi berhasil diambil",
    data: notifications,
  });
});

export const controlJemuran = asyncHandler(async (req, res) => {
  const { deviceId } = req.params;
  const { command } = req.body;

  const validCommands = Object.values(JEMURAN_STATE);
  if (!validCommands.includes(command)) {
    return res.status(400).json({
      success: false,
      error: `Perintah tidak valid! Gunakan ${validCommands.join(", ")}.`,
    });
  }

  const device = await prisma.device.findUnique({ where: { id: deviceId } });
  if (!device)
    return res
      .status(404)
      .json({ success: false, error: "Alat tidak ditemukan" });

  const payload = { action: command };
  const success = sendCommandWithDurationToDevice(device.serialNumber, payload);

  if (success) {
    if (command === JEMURAN_STATE.MASUK || command === JEMURAN_STATE.KELUAR) {
      await prisma.device.update({
        where: { id: deviceId },
        data: { posisiJemuran: command },
      });
    }

    res.json({
      success: true,
      message: `Perintah ${command} berhasil dikirim ke perangkat.`,
    });
  } else {
    const error = new Error("MQTT Broker sedang offline.");
    error.statusCode = 500;
    throw error;
  }
});

export const toggleNightMode = asyncHandler(async (req, res) => {
  const { deviceId } = req.params;
  const { nightModeEnabled } = req.body;

  const updatedDevice = await prisma.device.update({
    where: { id: deviceId },
    data: { nightModeEnabled },
  });

  const mode = nightModeEnabled ? NIGHT_MODE_STATE.ON : NIGHT_MODE_STATE.OFF;

  sendCommandWithDurationToDevice(updatedDevice.serialNumber, {
    action: mode,
  });

  res.json({
    success: true,
    message: "Mode malam diperbarui!",
    data: { device: updatedDevice },
  });
});

export const getWeatherByDeviceLocation = asyncHandler(async (req, res) => {
  const device = await prisma.device.findUnique({
    where: { id: req.params.deviceId },
    select: { locationCity: true },
  });

  if (!device || !device.locationCity) {
    return res.status(404).json({
      success: false,
      error: "Lokasi kota alat tidak ditemukan di database.",
    });
  }

  const weatherData = await fetchWeatherByCity(device.locationCity);
  res.json({
    success: true,
    message: "Data cuaca berhasil diambil",
    data: weatherData,
  });
});

export const markNotificationsAsRead = asyncHandler(async (req, res) => {
  const { deviceId } = req.params;

  await prisma.notification.updateMany({
    where: {
      deviceId: deviceId,
      isRead: false,
    },
    data: {
      isRead: true,
    },
  });

  res.json({
    success: true,
    message: "Semua notifikasi ditandai telah dibaca.",
  });
});

export const markSingleNotificationAsRead = asyncHandler(async (req, res) => {
  const { notifId } = req.params;

  await prisma.notification.update({
    where: { id: notifId },
    data: { isRead: true },
  });

  res.json({
    success: true,
    message: "Notifikasi berhasil ditandai telah dibaca.",
  });
});
