import { z } from "zod";

export const mqttPayloadSchema = z.object({
  deviceId: z.string({ required_error: "deviceId wajib disertakan" }).min(1),
  cuaca: z.string().optional().default("Cerah"),
  keamanan: z.string().optional().default("Aman"),
  posisiJemuran: z.string().optional().default("MASUK"),
  hujanADC: z.number().min(0).optional().default(0),
  ldrADC: z.number().min(0).optional().default(0),
  pirStatus: z.number().min(0).max(1).optional().default(0),
  isAutoMode: z.boolean().optional(),
});
