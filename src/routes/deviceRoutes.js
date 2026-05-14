import express from "express";
import {
  getMyDevices,
  claimDevice,
  getDeviceLogs,
  getDeviceNotifications,
  controlJemuran,
  toggleNightMode,
  getWeatherByDeviceLocation,
} from "../controllers/deviceController.js";
import { authenticateToken } from "../middlewares/authMiddleware.js";

const router = express.Router();

router.use(authenticateToken);

router.get("/", getMyDevices);
router.post("/claim", claimDevice);

router.get("/:deviceId/logs", getDeviceLogs);
router.get("/:deviceId/notifications", getDeviceNotifications);

router.post("/:deviceId/control", controlJemuran);
router.put("/:deviceId/nightmode", toggleNightMode);

router.get("/:deviceId/weather", getWeatherByDeviceLocation);

export default router;
