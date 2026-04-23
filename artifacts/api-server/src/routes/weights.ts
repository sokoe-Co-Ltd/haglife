import { Router, type IRouter } from "express";
import { eq, desc, and, gte, lte } from "drizzle-orm";
import { db, weightsTable, residentsTable } from "@workspace/db";
import {
  CreateWeightBody,
  UpdateWeightBody,
  UpdateWeightParams,
  DeleteWeightParams,
  ListWeightsQueryParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

function thisMonthRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  return { start, end };
}

router.get("/weights", async (req, res): Promise<void> => {
  const query = ListWeightsQueryParams.safeParse(req.query);
  const conditions = [];
  if (query.success && query.data.resident_id != null) {
    conditions.push(eq(weightsTable.residentId, query.data.resident_id));
  }
  if (query.success && query.data.this_month) {
    const { start, end } = thisMonthRange();
    conditions.push(gte(weightsTable.recordedAt, start));
    conditions.push(lte(weightsTable.recordedAt, end));
  }
  const rows = await db
    .select()
    .from(weightsTable)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(weightsTable.recordedAt));
  const residents = await db.select().from(residentsTable);
  const rMap = new Map(residents.map(r => [r.id, `${r.lastName}${r.firstName}`]));
  const result = rows.map(w => ({
    ...w,
    weightKg: parseFloat(String(w.weightKg)),
    residentName: rMap.get(w.residentId) ?? null,
  }));
  res.json(result);
});

router.post("/weights", async (req, res): Promise<void> => {
  const parsed = CreateWeightBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const data = {
    ...parsed.data,
    weightKg: String(parsed.data.weightKg),
    recordedAt: parsed.data.recordedAt ? new Date(parsed.data.recordedAt) : new Date(),
  };
  const [weight] = await db.insert(weightsTable).values(data).returning();
  const [resident] = await db.select().from(residentsTable).where(eq(residentsTable.id, weight.residentId));
  res.status(201).json({
    ...weight,
    weightKg: parseFloat(String(weight.weightKg)),
    residentName: resident ? `${resident.lastName}${resident.firstName}` : null,
  });
});

router.patch("/weights/:id", async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = UpdateWeightParams.safeParse({ id: parseInt(rawId, 10) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateWeightBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const updateData: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(parsed.data)) {
    if (v !== null && v !== undefined) {
      updateData[k] = k === "weightKg" ? String(v) : v;
    }
  }
  const [weight] = await db
    .update(weightsTable)
    .set(updateData)
    .where(eq(weightsTable.id, params.data.id))
    .returning();
  if (!weight) {
    res.status(404).json({ error: "体重記録が見つかりません" });
    return;
  }
  res.json({ ...weight, weightKg: parseFloat(String(weight.weightKg)) });
});

router.delete("/weights/:id", async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = DeleteWeightParams.safeParse({ id: parseInt(rawId, 10) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  await db.delete(weightsTable).where(eq(weightsTable.id, params.data.id));
  res.sendStatus(204);
});

router.get("/weights/monthly-status", async (req, res): Promise<void> => {
  const { start, end } = thisMonthRange();
  const residents = await db
    .select()
    .from(residentsTable)
    .where(eq(residentsTable.isVisible, true))
    .orderBy(residentsTable.roomNumber);
  const monthWeights = await db
    .select()
    .from(weightsTable)
    .where(and(gte(weightsTable.recordedAt, start), lte(weightsTable.recordedAt, end)));
  const result = residents.map(r => {
    const resWeights = monthWeights.filter(w => w.residentId === r.id);
    const latest = resWeights.sort((a, b) => b.recordedAt.getTime() - a.recordedAt.getTime())[0];
    return {
      residentId: r.id,
      residentName: `${r.lastName}${r.firstName}`,
      roomNumber: r.roomNumber,
      photoUrl: r.photoUrl ?? null,
      latestWeight: latest ? parseFloat(String(latest.weightKg)) : null,
      recordedThisMonth: resWeights.length > 0,
      lastRecordedAt: latest ? latest.recordedAt.toISOString() : null,
    };
  });
  res.json(result);
});

export default router;
