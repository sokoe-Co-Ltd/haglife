import { Router, type IRouter } from "express";
import { eq, desc, and, gte, lte } from "drizzle-orm";
import { db, mealsTable, residentsTable } from "@workspace/db";
import {
  CreateMealBody,
  UpdateMealBody,
  UpdateMealParams,
  DeleteMealParams,
  ListMealsQueryParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

function todayRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  return { start, end };
}

function dayRange(dateStr?: string | null) {
  const d = dateStr ? new Date(dateStr) : new Date();
  const start = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
  const end = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
  return { start, end };
}

router.get("/meals", async (req, res): Promise<void> => {
  const query = ListMealsQueryParams.safeParse(req.query);
  const conditions = [];
  if (query.success && query.data.resident_id != null) {
    conditions.push(eq(mealsTable.residentId, query.data.resident_id));
  }
  if (query.success && query.data.today_only) {
    const { start, end } = todayRange();
    conditions.push(gte(mealsTable.recordedAt, start));
    conditions.push(lte(mealsTable.recordedAt, end));
  } else if (query.success && query.data.date) {
    const { start, end } = dayRange(query.data.date);
    conditions.push(gte(mealsTable.recordedAt, start));
    conditions.push(lte(mealsTable.recordedAt, end));
  }
  const rows = await db.select().from(mealsTable)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(mealsTable.recordedAt));
  const result = rows.map(m => ({ ...m, residentName: null as string | null }));
  res.json(result);
});

router.post("/meals", async (req, res): Promise<void> => {
  const parsed = CreateMealBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const data = {
    ...parsed.data,
    recordedAt: parsed.data.recordedAt ? new Date(parsed.data.recordedAt) : new Date(),
  };
  const [meal] = await db.insert(mealsTable).values(data).returning();
  const [resident] = await db.select().from(residentsTable).where(eq(residentsTable.id, meal.residentId));
  res.status(201).json({ ...meal, residentName: resident ? `${resident.lastName}${resident.firstName}` : null });
});

router.patch("/meals/:id", async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = UpdateMealParams.safeParse({ id: parseInt(rawId, 10) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateMealBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const updateData: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(parsed.data)) {
    if (v !== undefined) updateData[k] = v;
  }
  const [meal] = await db
    .update(mealsTable)
    .set(updateData)
    .where(eq(mealsTable.id, params.data.id))
    .returning();
  if (!meal) {
    res.status(404).json({ error: "食事記録が見つかりません" });
    return;
  }
  res.json(meal);
});

router.delete("/meals/:id", async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = DeleteMealParams.safeParse({ id: parseInt(rawId, 10) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  await db.delete(mealsTable).where(eq(mealsTable.id, params.data.id));
  res.sendStatus(204);
});

export default router;
