import express from "express";
import {
  getMyDevices,
  claimDevice,
  getDeviceLogs,
  deleteDeviceLog,
  getDeviceNotifications,
  controlJemuran,
  toggleNightMode,
  getWeatherByDeviceLocation,
  markNotificationsAsRead,
  markSingleNotificationAsRead,
} from "../controllers/deviceController.js";
import { authenticateToken } from "../middlewares/authMiddleware.js";

const router = express.Router();

router.use(authenticateToken);

router.get("/", getMyDevices);
router.post("/claim", claimDevice);

router.get("/:deviceId/logs", getDeviceLogs);
router.delete("/:deviceId/logs/:logId", deleteDeviceLog);

router.get("/:deviceId/notifications", getDeviceNotifications);
router.put("/:deviceId/notifications/read", markNotificationsAsRead);
router.put(
  "/:deviceId/notifications/:notifId/read",
  markSingleNotificationAsRead,
);

router.post("/:deviceId/control", controlJemuran);
router.put("/:deviceId/nightmode", toggleNightMode);

router.get("/:deviceId/weather", getWeatherByDeviceLocation);

export default router;
