import prisma from "../config/db.js";
import { sendCommandWithDurationToDevice } from "../services/mqttService.js";

export const getMyDevices = async (req, res) => {
  try {
    const devices = await prisma.device.findMany({
      where: {
        users: { some: { id: req.user.userId } },
      },
      include: {
        _count: { select: { notifications: { where: { isRead: false } } } },
      },
    });
    res.json(devices);
  } catch (error) {
    res.status(500).json({ error: "Gagal mengambil daftar perangkat" });
  }
};

export const claimDevice = async (req, res) => {
  try {
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
        message: "Berhasil tersambung ke alat keluarga!",
        isShared: true,
        device,
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
      message: "Alat baru berhasil didaftarkan!",
      isShared: false,
      device,
    });
  } catch (error) {
    res.status(500).json({ error: "Gagal mendaftarkan alat." });
  }
};

export const getDeviceLogs = async (req, res) => {
  try {
    const { deviceId } = req.params;
    const logs = await prisma.sensorLog.findMany({
      where: { deviceId },
      orderBy: { createdAt: "desc" },
      take: 20,
    });

    if (!logs || logs.length === 0) {
      return res.json([]);
    }
    res.json(logs);
  } catch (error) {
    console.error("ERROR GET LOGS:", error);
    res.status(500).json({ error: "Gagal mengambil data log" });
  }
};

export const deleteDeviceLog = async (req, res) => {
  try {
    const { logId } = req.params;

    await prisma.sensorLog.delete({
      where: { id: logId },
    });

    res.json({ message: "Riwayat aktivitas berhasil dihapus." });
  } catch (error) {
    console.error("Gagal menghapus log:", error);
    res.status(500).json({ error: "Gagal menghapus log aktivitas." });
  }
};

export const getDeviceNotifications = async (req, res) => {
  try {
    const { deviceId } = req.params;
    const notifications = await prisma.notification.findMany({
      where: { deviceId },
      orderBy: { createdAt: "desc" },
      take: 20,
    });
    res.json(notifications);
  } catch (error) {
    res.status(500).json({ error: "Gagal mengambil notifikasi" });
  }
};

export const controlJemuran = async (req, res) => {
  try {
    const { deviceId } = req.params;
    const { command } = req.body;

    const validCommands = ["MASUK", "KELUAR", "AUTO_ON", "AUTO_OFF"];
    if (!validCommands.includes(command)) {
      return res.status(400).json({
        error:
          "Perintah tidak valid! Gunakan MASUK, KELUAR, AUTO_ON, atau AUTO_OFF.",
      });
    }

    const device = await prisma.device.findUnique({ where: { id: deviceId } });
    if (!device) return res.status(404).json({ error: "Alat tidak ditemukan" });

    const payload = { action: command };

    const success = sendCommandWithDurationToDevice(
      device.serialNumber,
      payload,
    );

    if (success) {
      if (command === "MASUK" || command === "KELUAR") {
        await prisma.device.update({
          where: { id: deviceId },
          data: { posisiJemuran: command },
        });
      }

      res.json({
        message: `Perintah ${command} berhasil dikirim ke perangkat.`,
      });
    } else {
      res.status(500).json({ error: "MQTT Broker sedang offline." });
    }
  } catch (error) {
    res.status(500).json({ error: "Gagal mengirim perintah." });
  }
};

export const toggleNightMode = async (req, res) => {
  try {
    const { deviceId } = req.params;
    const { nightModeEnabled } = req.body;

    const updatedDevice = await prisma.device.update({
      where: { id: deviceId },
      data: { nightModeEnabled },
    });

    const mode = nightModeEnabled ? "NIGHT_ON" : "NIGHT_OFF";

    sendCommandWithDurationToDevice(updatedDevice.serialNumber, {
      action: mode,
    });

    res.json({ message: "Mode malam diperbarui!", device: updatedDevice });
  } catch (error) {
    res.status(500).json({ error: "Gagal mengubah mode malam." });
  }
};

export const getWeatherByDeviceLocation = async (req, res) => {
  try {
    const device = await prisma.device.findUnique({
      where: { id: req.params.deviceId },
      select: { locationCity: true },
    });

    if (!device || !device.locationCity) {
      return res
        .status(404)
        .json({ error: "Lokasi kota alat tidak ditemukan di database." });
    }

    const apiKey = process.env.OPENWEATHER_API_KEY;
    const url = `https://api.openweathermap.org/data/2.5/weather?q=${device.locationCity}&appid=${apiKey}&units=metric&lang=id`;

    const response = await fetch(url);
    const weatherData = await response.json();

    if (weatherData.cod !== 200) {
      return res.status(weatherData.cod).json({ error: weatherData.message });
    }

    res.json(weatherData);
  } catch (error) {
    res.status(500).json({ error: "Gagal mengambil data cuaca." });
  }
};

export const markNotificationsAsRead = async (req, res) => {
  try {
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

    res.json({ message: "Semua notifikasi ditandai telah dibaca." });
  } catch (error) {
    res.status(500).json({ error: "Gagal memperbarui status notifikasi." });
  }
};

export const markSingleNotificationAsRead = async (req, res) => {
  try {
    const { notifId } = req.params;

    await prisma.notification.update({
      where: { id: notifId },
      data: { isRead: true },
    });

    res.json({ message: "Notifikasi berhasil ditandai telah dibaca." });
  } catch (error) {
    res.status(500).json({ error: "Gagal memperbarui status notifikasi." });
  }
};
