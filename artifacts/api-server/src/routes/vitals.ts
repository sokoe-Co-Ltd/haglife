import { Router, type IRouter } from "express";
import { eq, desc, and, gte, lte } from "drizzle-orm";
import { db, vitalsTable, residentsTable } from "@workspace/db";
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
  const rows = await db
    .select()
    .from(vitalsTable)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(vitalsTable.recordedAt));
  // Add residentName
  const residents = await db.select().from(residentsTable);
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

router.get("/vitals/today-status", async (req, res): Promise<void> => {
  const dateParam = typeof req.query.date === "string" ? req.query.date : undefined;
  const { start, end } = dateParam
    ? (() => { const d = new Date(dateParam); return { start: new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0), end: new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999) }; })()
    : todayRange();
  const residents = await db
    .select()
    .from(residentsTable)
    .where(eq(residentsTable.isVisible, true))
    .orderBy(residentsTable.roomNumber);
  const todayVitals = await db
    .select()
    .from(vitalsTable)
    .where(and(gte(vitalsTable.recordedAt, start), lte(vitalsTable.recordedAt, end)));
  const result = residents.map(r => {
    const resVitals = todayVitals.filter(v => v.residentId === r.id);
    const latest = resVitals.sort((a, b) => b.recordedAt.getTime() - a.recordedAt.getTime())[0];
    return {
      residentId: r.id,
      residentName: `${r.lastName}${r.firstName}`,
      roomNumber: r.roomNumber,
      photoUrl: r.photoUrl ?? null,
      birthMonth: r.birthMonth,
      birthDay: r.birthDay,
      latestVital: latest ? { ...latest, temperature: latest.temperature ? parseFloat(String(latest.temperature)) : null } : null,
      needsRecheck: latest?.needsRecheck ?? false,
      recordedToday: resVitals.length > 0,
    };
  });
  res.json(result);
});

export default router;
