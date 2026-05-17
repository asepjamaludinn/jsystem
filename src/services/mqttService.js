import mqtt from "mqtt";
import prisma from "../config/db.js";
import { mqttPayloadSchema } from "../validators/mqttValidator.js";
import {
  JEMURAN_STATE,
  WEATHER_STATE,
  SECURITY_STATE,
  DEVICE_STATUS,
} from "../utils/constants.js";

let mqttClient;
const deviceStates = {};

const offlineQueue = [];

const checkStateDifference = (lastState, data) => {
  return (
    lastState.cuaca !== data.cuaca ||
    lastState.keamanan !== data.keamanan ||
    lastState.posisiJemuran !== data.posisiJemuran
  );
};

const logSensorActivity = async (deviceId, data) => {
  await prisma.sensorLog.create({
    data: {
      deviceId,
      cuaca: data.cuaca,
      keamanan: data.keamanan,
      hujanADC: data.hujanADC,
      ldrADC: data.ldrADC,
      pirStatus: data.pirStatus,
    },
  });
};

const updateDeviceStatus = async (deviceId, posisiJemuran) => {
  if (posisiJemuran) {
    await prisma.device.update({
      where: { id: deviceId },
      data: { posisiJemuran, status: DEVICE_STATUS.ONLINE },
    });
  }
};

const createAndEmitNotification = async (deviceId, type, message, io) => {
  const notif = await prisma.notification.create({
    data: { deviceId, type, message },
  });
  io.emit("notification", notif);
};

const checkAndSendNotifications = async (device, data, lastState, io) => {
  if (
    data.cuaca === WEATHER_STATE.HUJAN &&
    lastState.cuaca !== WEATHER_STATE.HUJAN
  ) {
    await createAndEmitNotification(
      device.id,
      "warning",
      "Hujan Turun! Motor servo otomatis menarik jemuran ke tempat teduh.",
      io,
    );
  }

  if (
    data.posisiJemuran === JEMURAN_STATE.KELUAR &&
    lastState.posisiJemuran === JEMURAN_STATE.MASUK
  ) {
    await createAndEmitNotification(
      device.id,
      "info",
      "Cuaca kembali cerah. Pakaian dikeluarkan secara otomatis untuk dijemur.",
      io,
    );
  }

  if (
    data.posisiJemuran === JEMURAN_STATE.MASUK &&
    lastState.posisiJemuran === JEMURAN_STATE.KELUAR &&
    data.cuaca !== WEATHER_STATE.HUJAN
  ) {
    await createAndEmitNotification(
      device.id,
      "info",
      "Kondisi lingkungan minim cahaya (Gelap). Jemuran ditarik masuk demi keamanan pakaian.",
      io,
    );
  }

  if (
    (data.pirStatus === 1 || data.keamanan === SECURITY_STATE.ADA_ORANG) &&
    lastState.keamanan !== SECURITY_STATE.ADA_ORANG
  ) {
    await createAndEmitNotification(
      device.id,
      "danger",
      "Peringatan Keamanan! Terdeteksi pergerakan mencurigakan di area jemuran!",
      io,
    );
  }
};

const handleDeviceStateChange = async (device, data, lastState, io) => {
  console.log(
    `[LOG] Perubahan status terdeteksi pada device: ${device.serialNumber}`,
  );
  await logSensorActivity(device.id, data);
  await updateDeviceStatus(device.id, data.posisiJemuran);
  await checkAndSendNotifications(device, data, lastState, io);
};

export const initMqtt = (io) => {
  mqttClient = mqtt.connect(process.env.MQTT_BROKER_URL, {
    username: process.env.MQTT_USERNAME,
    password: process.env.MQTT_PASSWORD,
    protocol: "mqtts",
    reconnectPeriod: 5000,
  });

  mqttClient.on("connect", () => {
    console.log("Terhubung ke Broker MQTT HiveMQ!");

    if (offlineQueue.length > 0) {
      console.log(
        `[MQTT] Memproses ${offlineQueue.length} pesan tertunda dari antrean...`,
      );
      while (offlineQueue.length > 0) {
        const { topic, message } = offlineQueue.shift();
        mqttClient.publish(topic, message);
        console.log(`[MQTT] Berhasil mengirim pesan tertunda ke ${topic}`);
      }
    }

    mqttClient.subscribe("jemuran/sensor", (err) => {
      if (!err) console.log("Mendengarkan topik: jemuran/sensor");
    });
  });

  mqttClient.on("offline", () => {
    console.warn(
      "[MQTT Peringatan] Koneksi broker terputus. Sistem beralih ke mode antrean (Queue Mode).",
    );
  });

  mqttClient.on("message", async (topic, message) => {
    try {
      let parsedJson;
      try {
        parsedJson = JSON.parse(message.toString());
      } catch (parseError) {
        console.warn(
          "[MQTT Peringatan] Mengabaikan payload rusak (Malformed JSON):",
          message.toString(),
        );
        return;
      }

      const validation = mqttPayloadSchema.safeParse(parsedJson);

      if (!validation.success) {
        console.warn(
          "[MQTT Peringatan] Struktur payload tidak sesuai skema (Zod):",
          validation.error.format(),
        );
        return;
      }

      const data = validation.data;

      const device = await prisma.device.findUnique({
        where: { serialNumber: data.deviceId },
      });

      if (!device) return;

      data.deviceId = device.id;

      io.emit("sensorUpdate", data);

      const lastState = deviceStates[device.id] || {};
      const isChanged = checkStateDifference(lastState, data);

      if (isChanged) {
        await handleDeviceStateChange(device, data, lastState, io);

        deviceStates[device.id] = {
          cuaca: data.cuaca,
          keamanan: data.keamanan,
          posisiJemuran: data.posisiJemuran,
        };
      }
    } catch (error) {
      console.error("[MQTT Error Kesistem]:", error.message);
    }
  });
};

export const sendCommandWithDurationToDevice = (serialNumber, payloadObj) => {
  const topic = `jemuran/control/${serialNumber}`;
  const message = JSON.stringify(payloadObj);

  if (mqttClient && mqttClient.connected) {
    mqttClient.publish(topic, message);
    return { success: true, queued: false };
  } else {
    console.warn(
      `[MQTT] Broker offline. Memasukkan perintah ke dalam antrean: ${topic}`,
    );
    offlineQueue.push({ topic, message });
    return { success: true, queued: true };
  }
};
