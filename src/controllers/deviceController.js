import prisma from "../config/db.js";
import { sendCommandToDevice } from "../services/mqttService.js";

export const getMyDevices = async (req, res) => {
  try {
    const devices = await prisma.device.findMany({
      where: { userId: req.user.userId },
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
    const { serialNumber, name } = req.body;
    const newDevice = await prisma.device.create({
      data: { serialNumber, name, userId: req.user.userId },
    });
    res
      .status(201)
      .json({ message: "Alat berhasil ditambahkan!", device: newDevice });
  } catch (error) {
    if (error.code === "P2002") {
      return res.status(400).json({ error: "Serial Number sudah digunakan!" });
    }
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
    res.json(logs);
  } catch (error) {
    res.status(500).json({ error: "Gagal mengambil data log" });
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

    if (command !== "MASUK" && command !== "KELUAR") {
      return res
        .status(400)
        .json({ error: "Perintah tidak valid! Gunakan MASUK atau KELUAR." });
    }

    const success = sendCommandToDevice(deviceId, command);
    if (success) {
      await prisma.device.update({
        where: { id: deviceId },
        data: { posisiJemuran: command },
      });
      res.json({
        message: `Perintah ${command} berhasil dikirim ke motor servo.`,
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
    sendCommandToDevice(deviceId, mode);

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
      return res.status(404).json({ error: "Lokasi alat tidak ditemukan." });
    }

    const apiKey = process.env.OPENWEATHER_API_KEY;
    const url = `https://api.openweathermap.org/data/2.5/weather?q=${device.locationCity}&appid=${apiKey}&units=metric&lang=id`;

    const response = await fetch(url);
    const weatherData = await response.json();

    res.json(weatherData);
  } catch (error) {
    res.status(500).json({ error: "Gagal mengambil data cuaca." });
  }
};
