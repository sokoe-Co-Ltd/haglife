import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, dayServicesTable, residentsTable } from "@workspace/db";
import {
  CreateDayServiceBody,
  UpdateDayServiceBody,
  UpdateDayServiceParams,
  DeleteDayServiceParams,
  ToggleDayServicePreparedParams,
  ListDayServicesQueryParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

function getJapaneseDayOfWeek(): string {
  const days = ["日", "月", "火", "水", "木", "金", "土"];
  return days[new Date().getDay()];
}

const VALID_WEEKDAYS = new Set(["月", "火", "水", "木", "金", "土", "日"]);

function validateUsageDays(days: string[] | undefined): string | null {
  if (!days) return null;
  const invalid = days.filter((d) => !VALID_WEEKDAYS.has(d));
  if (invalid.length > 0) {
    return `不正な曜日が含まれています: ${invalid.join(", ")}`;
  }
  return null;
}

router.get("/day-services", async (req, res): Promise<void> => {
  const query = ListDayServicesQueryParams.safeParse(req.query);
  const conditions = [];
  if (query.success && query.data.resident_id != null) {
    conditions.push(eq(dayServicesTable.residentId, query.data.resident_id));
  }
  const rows = await db
    .select()
    .from(dayServicesTable)
    .where(conditions.length > 0 ? and(...conditions) : undefined);
  const residents = await db.select().from(residentsTable);
  const rMap = new Map(residents.map(r => [r.id, `${r.lastName}${r.firstName}`]));

  let result = rows.map(d => ({ ...d, residentName: rMap.get(d.residentId) ?? null }));

  // Filter by day_of_week if specified
  if (query.success && query.data.day_of_week) {
    result = result.filter(d => d.usageDays.includes(query.data.day_of_week!));
  } else if (!query.success || query.data.resident_id == null) {
    // Default to today's day
    const today = getJapaneseDayOfWeek();
    result = result.filter(d => d.usageDays.includes(today));
  }

  res.json(result);
});

router.post("/day-services", async (req, res): Promise<void> => {
  const parsed = CreateDayServiceBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const dayError = validateUsageDays(parsed.data.usageDays);
  if (dayError) {
    res.status(400).json({ error: dayError });
    return;
  }
  const [service] = await db.insert(dayServicesTable).values(parsed.data).returning();
  const [resident] = await db.select().from(residentsTable).where(eq(residentsTable.id, service.residentId));
  res.status(201).json({ ...service, residentName: resident ? `${resident.lastName}${resident.firstName}` : null });
});

router.patch("/day-services/:id", async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = UpdateDayServiceParams.safeParse({ id: parseInt(rawId, 10) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateDayServiceBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const dayError = validateUsageDays(parsed.data.usageDays ?? undefined);
  if (dayError) {
    res.status(400).json({ error: dayError });
    return;
  }
  const updateData: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(parsed.data)) {
    if (v !== undefined) updateData[k] = v;
  }
  const [service] = await db
    .update(dayServicesTable)
    .set(updateData)
    .where(eq(dayServicesTable.id, params.data.id))
    .returning();
  if (!service) {
    res.status(404).json({ error: "デイ準備物が見つかりません" });
    return;
  }
  res.json(service);
});

router.delete("/day-services/:id", async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = DeleteDayServiceParams.safeParse({ id: parseInt(rawId, 10) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  await db.delete(dayServicesTable).where(eq(dayServicesTable.id, params.data.id));
  res.sendStatus(204);
});

router.post("/day-services/:id/toggle-prepared", async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = ToggleDayServicePreparedParams.safeParse({ id: parseInt(rawId, 10) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [current] = await db
    .select()
    .from(dayServicesTable)
    .where(eq(dayServicesTable.id, params.data.id));
  if (!current) {
    res.status(404).json({ error: "デイ準備物が見つかりません" });
    return;
  }
  const [service] = await db
    .update(dayServicesTable)
    .set({ isPrepared: !current.isPrepared })
    .where(eq(dayServicesTable.id, params.data.id))
    .returning();
  res.json(service);
});

export default router;
