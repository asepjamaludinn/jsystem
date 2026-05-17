import cron from "node-cron";
import prisma from "../config/db.js";

export const initCronJobs = () => {
  cron.schedule("0 0 * * *", async () => {
    console.log("[CRON] Menjalankan pembersihan database otomatis...");

    try {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const deletedLogs = await prisma.sensorLog.deleteMany({
        where: {
          createdAt: {
            lt: sevenDaysAgo,
          },
        },
      });

      const deletedNotifs = await prisma.notification.deleteMany({
        where: {
          createdAt: {
            lt: sevenDaysAgo,
          },
        },
      });

      console.log(`[CRON] Berhasil menghapus ${deletedLogs.count} Log lama.`);
      console.log(
        `[CRON] Berhasil menghapus ${deletedNotifs.count} Notifikasi lama.`,
      );
    } catch (error) {
      console.error("[CRON] Gagal membersihkan database:", error.message);
    }
  });
};
