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

  const limit = parseInt(req.query.limit) || 20;
  const page = parseInt(req.query.page) || 1;
  const skip = (page - 1) * limit;

  const logs = await prisma.sensorLog.findMany({
    where: { deviceId },
    orderBy: { createdAt: "desc" },
    take: limit,
    skip: skip,
  });

  const totalLogs = await prisma.sensorLog.count({
    where: { deviceId },
  });

  if (!logs || logs.length === 0) {
    return res.json({
      success: true,
      message: "Log perangkat kosong",
      data: [],
      pagination: {
        total: totalLogs,
        page,
        limit,
        totalPages: Math.ceil(totalLogs / limit),
      },
    });
  }

  res.json({
    success: true,
    message: "Log berhasil diambil",
    data: logs,
    pagination: {
      total: totalLogs,
      page,
      limit,
      totalPages: Math.ceil(totalLogs / limit),
    },
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

  const limit = parseInt(req.query.limit) || 20;
  const page = parseInt(req.query.page) || 1;
  const skip = (page - 1) * limit;

  const notifications = await prisma.notification.findMany({
    where: { deviceId },
    orderBy: { createdAt: "desc" },
    take: limit,
    skip: skip,
  });

  const totalNotifs = await prisma.notification.count({
    where: { deviceId },
  });

  res.json({
    success: true,
    message: "Notifikasi berhasil diambil",
    data: notifications,
    pagination: {
      total: totalNotifs,
      page,
      limit,
      totalPages: Math.ceil(totalNotifs / limit),
    },
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

  const result = sendCommandWithDurationToDevice(device.serialNumber, payload);

  if (result.success) {
    if (command === JEMURAN_STATE.MASUK || command === JEMURAN_STATE.KELUAR) {
      await prisma.device.update({
        where: { id: deviceId },
        data: { posisiJemuran: command },
      });
    }

    res.json({
      success: true,
      message: result.queued
        ? `Broker offline. Perintah ${command} telah dimasukkan ke dalam antrean.`
        : `Perintah ${command} berhasil dikirim ke perangkat.`,
    });
  } else {
    return res.status(500).json({
      success: false,
      error: "Gagal memproses perintah MQTT.",
    });
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

  const result = sendCommandWithDurationToDevice(updatedDevice.serialNumber, {
    action: mode,
  });

  res.json({
    success: true,
    message: result.queued
      ? "Mode malam diperbarui! (Namun masuk antrean karena broker sedang offline)"
      : "Mode malam diperbarui!",
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

export const unclaimDevice = asyncHandler(async (req, res) => {
  const { deviceId } = req.params;
  const userId = req.user.userId;

  await prisma.device.update({
    where: { id: deviceId },
    data: {
      users: { disconnect: { id: userId } },
    },
  });

  res.json({
    success: true,
    message: "Perangkat berhasil dihapus dari akun Anda.",
  });
});
