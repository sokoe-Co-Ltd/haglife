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

export default router;
