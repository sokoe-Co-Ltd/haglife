import { Router } from "express";
import { db, facilitySettingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

const MEAL_TIMES_KEY = "meal_time_windows";

const DEFAULT_MEAL_TIMES = {
  朝食: { start: 6, end: 10 },
  昼食: { start: 11, end: 16 },
  夕食: { start: 17, end: 23 },
};

router.get("/settings/meal-times", async (_req, res): Promise<void> => {
  try {
    const [row] = await db.select().from(facilitySettingsTable).where(eq(facilitySettingsTable.key, MEAL_TIMES_KEY));
    if (!row) {
      res.json(DEFAULT_MEAL_TIMES);
      return;
    }
    res.json(JSON.parse(row.value));
  } catch {
    res.json(DEFAULT_MEAL_TIMES);
  }
});

router.put("/settings/meal-times", async (req, res): Promise<void> => {
  const body = req.body;
  if (!body || typeof body !== "object") {
    res.status(400).json({ error: "Invalid body" });
    return;
  }
  const value = JSON.stringify(body);
  await db
    .insert(facilitySettingsTable)
    .values({ key: MEAL_TIMES_KEY, value, updatedAt: new Date() })
    .onConflictDoUpdate({ target: facilitySettingsTable.key, set: { value, updatedAt: new Date() } });
  res.json(JSON.parse(value));
});

const VITAL_THRESHOLDS_KEY = "vital_thresholds";

const DEFAULT_VITAL_THRESHOLDS = {
  temperature: { min: 35.8, max: 37.4 },
  bpSystolic:  { min: 90,   max: 159  },
  bpDiastolic: { min: 60,   max: 99   },
  pulse:       { min: 50,   max: 100  },
  spo2:        { min: 95,   max: 100  },
};

router.get("/settings/vital-thresholds", async (_req, res): Promise<void> => {
  try {
    const [row] = await db.select().from(facilitySettingsTable).where(eq(facilitySettingsTable.key, VITAL_THRESHOLDS_KEY));
    if (!row) {
      res.json(DEFAULT_VITAL_THRESHOLDS);
      return;
    }
    res.json(JSON.parse(row.value));
  } catch {
    res.json(DEFAULT_VITAL_THRESHOLDS);
  }
});

router.put("/settings/vital-thresholds", async (req, res): Promise<void> => {
  const body = req.body;
  if (!body || typeof body !== "object") {
    res.status(400).json({ error: "Invalid body" });
    return;
  }
  const value = JSON.stringify(body);
  await db
    .insert(facilitySettingsTable)
    .values({ key: VITAL_THRESHOLDS_KEY, value, updatedAt: new Date() })
    .onConflictDoUpdate({ target: facilitySettingsTable.key, set: { value, updatedAt: new Date() } });
  res.json(JSON.parse(value));
});

export default router;
