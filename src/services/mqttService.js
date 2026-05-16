import mqtt from "mqtt";
import prisma from "../config/db.js";

let mqttClient;

const deviceStates = {};

export const initMqtt = (io) => {
  mqttClient = mqtt.connect(process.env.MQTT_BROKER_URL, {
    username: process.env.MQTT_USERNAME,
    password: process.env.MQTT_PASSWORD,
    protocol: "mqtts",
  });

  mqttClient.on("connect", () => {
    console.log("Terhubung ke Broker MQTT HiveMQ!");
    mqttClient.subscribe("jemuran/sensor", (err) => {
      if (!err) console.log("Mendengarkan topik: jemuran/sensor");
    });
  });

  mqttClient.on("message", async (topic, message) => {
    try {
      const data = JSON.parse(message.toString());

      if (data.deviceId) {
        const device = await prisma.device.findUnique({
          where: { serialNumber: data.deviceId },
        });

        if (!device) return;

        data.deviceId = device.id;

        io.emit("sensorUpdate", data);

        const lastState = deviceStates[device.id] || {};

        const isChanged =
          lastState.cuaca !== data.cuaca ||
          lastState.keamanan !== data.keamanan ||
          lastState.posisiJemuran !== data.posisiJemuran;

        if (isChanged) {
          console.log(
            `[LOG] Perubahan status terdeteksi pada device: ${device.serialNumber}`,
          );

          await prisma.sensorLog.create({
            data: {
              deviceId: device.id,
              cuaca: data.cuaca,
              keamanan: data.keamanan,
              hujanADC: data.hujanADC,
              ldrADC: data.ldrADC,
              pirStatus: data.pirStatus,
            },
          });

          if (data.posisiJemuran) {
            await prisma.device.update({
              where: { id: device.id },
              data: { posisiJemuran: data.posisiJemuran, status: "online" },
            });
          }

          if (data.cuaca === "Hujan" && lastState.cuaca !== "Hujan") {
            const notif = await prisma.notification.create({
              data: {
                deviceId: device.id,
                type: "warning",
                message:
                  "Hujan Turun! Motor servo otomatis menarik jemuran ke tempat teduh.",
              },
            });
            io.emit("notification", notif);
          }

          if (
            data.posisiJemuran === "KELUAR" &&
            lastState.posisiJemuran === "MASUK"
          ) {
            const notif = await prisma.notification.create({
              data: {
                deviceId: device.id,
                type: "info",
                message:
                  "Cuaca kembali cerah. Pakaian dikeluarkan secara otomatis untuk dijemur.",
              },
            });
            io.emit("notification", notif);
          }

          if (
            data.posisiJemuran === "MASUK" &&
            lastState.posisiJemuran === "KELUAR" &&
            data.cuaca !== "Hujan"
          ) {
            const notif = await prisma.notification.create({
              data: {
                deviceId: device.id,
                type: "info",
                message:
                  "Kondisi lingkungan minim cahaya (Gelap). Jemuran ditarik masuk demi keamanan pakaian.",
              },
            });
            io.emit("notification", notif);
          }

          if (
            (data.pirStatus === 1 || data.keamanan === "ADA ORANG!") &&
            lastState.keamanan !== "ADA ORANG!"
          ) {
            const notif = await prisma.notification.create({
              data: {
                deviceId: device.id,
                type: "danger",
                message:
                  "Peringatan Keamanan! Terdeteksi pergerakan mencurigakan di area jemuran!",
              },
            });
            io.emit("notification", notif);
          }

          deviceStates[device.id] = {
            cuaca: data.cuaca,
            keamanan: data.keamanan,
            posisiJemuran: data.posisiJemuran,
          };
        }
      }
    } catch (error) {
      console.error("Gagal memproses pesan MQTT:", error.message);
    }
  });
};

export const sendCommandWithDurationToDevice = (serialNumber, payloadObj) => {
  if (mqttClient && mqttClient.connected) {
    const topic = `jemuran/control/${serialNumber}`;
    mqttClient.publish(topic, JSON.stringify(payloadObj));
    return true;
  }
  return false;
};
