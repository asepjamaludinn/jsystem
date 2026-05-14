import mqtt from "mqtt";
import prisma from "../config/db.js";

let mqttClient;

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
      console.log(`[MQTT] Data masuk di ${topic}:`, data);

      if (data.deviceId) {
        await prisma.sensorLog.create({
          data: {
            deviceId: data.deviceId,
            cuaca: data.cuaca,
            keamanan: data.keamanan,
            hujanADC: data.hujanADC,
            ldrADC: data.ldrADC,
            pirStatus: data.pirStatus,
          },
        });

        if (data.posisiJemuran) {
          await prisma.device.update({
            where: { id: data.deviceId },
            data: { posisiJemuran: data.posisiJemuran },
          });
        }

        io.emit("sensorUpdate", data);

        if (data.cuaca === "Hujan") {
          const notif = await prisma.notification.create({
            data: {
              deviceId: data.deviceId,
              type: "warning",
              message:
                "Hujan Turun! Motor servo otomatis menarik jemuran ke tempat teduh.",
            },
          });
          io.emit("notification", notif);
        }

        if (data.pirStatus === 1 || data.keamanan === "ADA ORANG!") {
          const notif = await prisma.notification.create({
            data: {
              deviceId: data.deviceId,
              type: "danger",
              message:
                "Peringatan Keamanan! Terdeteksi pergerakan di area jemuran!",
            },
          });
          io.emit("notification", notif);
        }
      }
    } catch (error) {
      console.error("Gagal memproses pesan MQTT:", error.message);
    }
  });
};

export const sendCommandToDevice = (deviceId, command) => {
  if (mqttClient && mqttClient.connected) {
    const topic = `jemuran/control/${deviceId}`;
    mqttClient.publish(topic, JSON.stringify({ action: command }));
    return true;
  }
  return false;
};
