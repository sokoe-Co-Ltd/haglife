import { Router, type IRouter } from "express";
import { eq, desc, and, gte, lte } from "drizzle-orm";
import { db, vitalsTable, residentsTable, facilitySettingsTable } from "@workspace/db";
import {
  CreateVitalBody,
  UpdateVitalBody,
  UpdateVitalParams,
  DeleteVitalParams,
  ListVitalsQueryParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

function todayRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  return { start, end };
}

router.get("/vitals", async (req, res): Promise<void> => {
  const query = ListVitalsQueryParams.safeParse(req.query);
  const conditions = [];
  if (query.success && query.data.resident_id != null) {
    conditions.push(eq(vitalsTable.residentId, query.data.resident_id));
  }
  if (query.success && query.data.today_only) {
    const { start, end } = todayRange();
    conditions.push(gte(vitalsTable.recordedAt, start));
    conditions.push(lte(vitalsTable.recordedAt, end));
  }
  if (query.success && query.data.date) {
    const d = new Date(query.data.date);
    const start = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
    const end = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
    conditions.push(gte(vitalsTable.recordedAt, start));
    conditions.push(lte(vitalsTable.recordedAt, end));
  }
  const [rows, residents] = await Promise.all([
    db.select().from(vitalsTable)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(vitalsTable.recordedAt)),
    db.select({ id: residentsTable.id, lastName: residentsTable.lastName, firstName: residentsTable.firstName })
      .from(residentsTable),
  ]);
  const rMap = new Map(residents.map(r => [r.id, `${r.lastName}${r.firstName}`]));
  const result = rows.map(v => ({
    ...v,
    temperature: v.temperature ? parseFloat(String(v.temperature)) : null,
    residentName: rMap.get(v.residentId) ?? null,
  }));
  res.json(result);
});

router.post("/vitals", async (req, res): Promise<void> => {
  const parsed = CreateVitalBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const data = {
    ...parsed.data,
    recordedAt: parsed.data.recordedAt ? new Date(parsed.data.recordedAt) : new Date(),
    temperature: parsed.data.temperature != null ? String(parsed.data.temperature) : null,
  };
  const [vital] = await db.insert(vitalsTable).values(data).returning();
  const [resident] = await db.select().from(residentsTable).where(eq(residentsTable.id, vital.residentId));
  res.status(201).json({
    ...vital,
    temperature: vital.temperature ? parseFloat(String(vital.temperature)) : null,
    residentName: resident ? `${resident.lastName}${resident.firstName}` : null,
  });
});

router.patch("/vitals/:id", async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = UpdateVitalParams.safeParse({ id: parseInt(rawId, 10) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateVitalBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const updateData: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(parsed.data)) {
    if (v !== null && v !== undefined) {
      updateData[k] = k === "temperature" ? String(v) : v;
    }
  }
  const [vital] = await db
    .update(vitalsTable)
    .set(updateData)
    .where(eq(vitalsTable.id, params.data.id))
    .returning();
  if (!vital) {
    res.status(404).json({ error: "バイタルが見つかりません" });
    return;
  }
  res.json({ ...vital, temperature: vital.temperature ? parseFloat(String(vital.temperature)) : null });
});

router.delete("/vitals/:id", async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = DeleteVitalParams.safeParse({ id: parseInt(rawId, 10) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  await db.delete(vitalsTable).where(eq(vitalsTable.id, params.data.id));
  res.sendStatus(204);
});

const DEFAULT_VITAL_THRESHOLDS = {
  temperature: { min: 35.8, max: 37.4 },
  bpSystolic:  { min: 90,   max: 159  },
  bpDiastolic: { min: 60,   max: 99   },
  pulse:       { min: 50,   max: 100  },
  spo2:        { min: 95,   max: 100  },
};

type ThresholdRange = { min: number; max: number };
type VitalThresholds = {
  temperature: ThresholdRange;
  bpSystolic: ThresholdRange;
  bpDiastolic: ThresholdRange;
  pulse: ThresholdRange;
  spo2: ThresholdRange;
};

function isVitalOut(val: number | null | undefined, range: ThresholdRange): boolean {
  if (val == null || isNaN(val)) return false;
  return val < range.min || val > range.max;
}

function computeNeedsRecheck(
  vital: { temperature?: string | null; bpSystolic?: number | null; bpDiastolic?: number | null; pulse?: number | null; spo2?: number | null },
  thresholds: VitalThresholds
): boolean {
  const temp = vital.temperature ? parseFloat(String(vital.temperature)) : null;
  return (
    isVitalOut(temp, thresholds.temperature) ||
    isVitalOut(vital.bpSystolic, thresholds.bpSystolic) ||
    isVitalOut(vital.bpDiastolic, thresholds.bpDiastolic) ||
    isVitalOut(vital.pulse, thresholds.pulse) ||
    isVitalOut(vital.spo2, thresholds.spo2)
  );
}

async function getGlobalThresholds(): Promise<VitalThresholds> {
  try {
    const [row] = await db.select().from(facilitySettingsTable).where(eq(facilitySettingsTable.key, "vital_thresholds"));
    if (row) return JSON.parse(row.value) as VitalThresholds;
  } catch { /* fall through */ }
  return DEFAULT_VITAL_THRESHOLDS;
}

router.get("/vitals/today-status", async (req, res): Promise<void> => {
  const dateParam = typeof req.query.date === "string" ? req.query.date : undefined;
  const { start, end } = dateParam
    ? (() => { const d = new Date(dateParam); return { start: new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0), end: new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999) }; })()
    : todayRange();
  const [residents, todayVitals, globalThresholds] = await Promise.all([
    db.select().from(residentsTable).where(eq(residentsTable.isVisible, true)).orderBy(residentsTable.roomNumber),
    db.select().from(vitalsTable).where(and(gte(vitalsTable.recordedAt, start), lte(vitalsTable.recordedAt, end))),
    getGlobalThresholds(),
  ]);
  const result = residents.map(r => {
    const resVitals = todayVitals.filter(v => v.residentId === r.id);
    const latest = resVitals.sort((a, b) => b.recordedAt.getTime() - a.recordedAt.getTime())[0];
    let effectiveThresholds = globalThresholds;
    if (r.vitalThresholdsJson) {
      try { effectiveThresholds = JSON.parse(r.vitalThresholdsJson) as VitalThresholds; } catch { /* use global */ }
    }
    const needsRecheck = latest ? computeNeedsRecheck(latest, effectiveThresholds) : false;
    return {
      residentId: r.id,
      residentName: `${r.lastName}${r.firstName}`,
      roomNumber: r.roomNumber,
      photoUrl: r.photoUrl ?? null,
      birthMonth: r.birthMonth,
      birthDay: r.birthDay,
      latestVital: latest ? { ...latest, temperature: latest.temperature ? parseFloat(String(latest.temperature)) : null } : null,
      needsRecheck,
      recordedToday: resVitals.length > 0,
    };
  });
  res.json(result);
});

export default router;
