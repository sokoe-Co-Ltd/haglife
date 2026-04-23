import { Router, type IRouter } from "express";
import { eq, desc, and, gte } from "drizzle-orm";
import { db, eliminationsTable, eliminationRoundChecksTable, eliminationRoundStateTable, residentsTable } from "@workspace/db";
import {
  CreateEliminationBody,
  DeleteEliminationParams,
  ListEliminationsQueryParams,
  CheckEliminationRoundBody,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/eliminations", async (req, res): Promise<void> => {
  const query = ListEliminationsQueryParams.safeParse(req.query);
  const conditions = [];
  if (query.success && query.data.resident_id != null) {
    conditions.push(eq(eliminationsTable.residentId, query.data.resident_id));
  }
  const rows = await db
    .select()
    .from(eliminationsTable)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(eliminationsTable.recordedAt));
  const residents = await db.select().from(residentsTable);
  const rMap = new Map(residents.map(r => [r.id, `${r.lastName}${r.firstName}`]));
  const result = rows.map(e => ({ ...e, residentName: rMap.get(e.residentId) ?? null }));
  res.json(result);
});

router.post("/eliminations", async (req, res): Promise<void> => {
  const parsed = CreateEliminationBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const data = {
    ...parsed.data,
    recordedAt: parsed.data.recordedAt ? new Date(parsed.data.recordedAt) : new Date(),
  };
  const [elimination] = await db.insert(eliminationsTable).values(data).returning();
  const [resident] = await db.select().from(residentsTable).where(eq(residentsTable.id, elimination.residentId));
  res.status(201).json({ ...elimination, residentName: resident ? `${resident.lastName}${resident.firstName}` : null });
});

router.delete("/eliminations/:id", async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = DeleteEliminationParams.safeParse({ id: parseInt(rawId, 10) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  await db.delete(eliminationsTable).where(eq(eliminationsTable.id, params.data.id));
  res.sendStatus(204);
});

router.get("/eliminations/round-status", async (req, res): Promise<void> => {
  const residents = await db
    .select()
    .from(residentsTable)
    .where(eq(residentsTable.isVisible, true))
    .orderBy(residentsTable.roomNumber);

  // Get current round reset time
  const [state] = await db.select().from(eliminationRoundStateTable).orderBy(desc(eliminationRoundStateTable.lastResetAt)).limit(1);
  const resetAt = state?.lastResetAt ?? new Date(0);

  // Get round checks after last reset
  const roundChecks = await db
    .select()
    .from(eliminationRoundChecksTable)
    .where(and(eq(eliminationRoundChecksTable.isActive, true), gte(eliminationRoundChecksTable.checkedAt, resetAt)));

  // Get last BM for each resident (type === '便')
  const allBm = await db
    .select()
    .from(eliminationsTable)
    .where(eq(eliminationsTable.type, "便"))
    .orderBy(desc(eliminationsTable.recordedAt));

  const lastBmMap = new Map<number, Date>();
  for (const e of allBm) {
    if (!lastBmMap.has(e.residentId)) lastBmMap.set(e.residentId, e.recordedAt);
  }

  const now = new Date();
  const result = residents.map(r => {
    const lastBm = lastBmMap.get(r.id);
    const daysSinceLastBm = lastBm
      ? Math.floor((now.getTime() - lastBm.getTime()) / (1000 * 60 * 60 * 24))
      : null;
    const checkedThisRound = roundChecks.some(c => c.residentId === r.id);
    const needsAttention = !r.stomaManagement && (daysSinceLastBm === null || daysSinceLastBm >= 3);
    return {
      residentId: r.id,
      residentName: `${r.lastName}${r.firstName}`,
      roomNumber: r.roomNumber,
      photoUrl: r.photoUrl ?? null,
      stomaManagement: r.stomaManagement,
      lastBmRecordedAt: lastBm ? lastBm.toISOString() : null,
      daysSinceLastBm,
      checkedThisRound,
      needsAttention,
    };
  });
  res.json(result);
});

router.post("/eliminations/rounds/check", async (req, res): Promise<void> => {
  const parsed = CheckEliminationRoundBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [state] = await db.select().from(eliminationRoundStateTable).orderBy(desc(eliminationRoundStateTable.lastResetAt)).limit(1);
  const resetAt = state?.lastResetAt ?? new Date(0);
  await db.insert(eliminationRoundChecksTable).values({
    residentId: parsed.data.residentId,
    staffId: parsed.data.staffId ?? null,
    checkedAt: new Date(),
    roundResetAt: resetAt,
    isActive: true,
  });
  res.json({ success: true });
});

router.post("/eliminations/rounds/reset", async (_req, res): Promise<void> => {
  await db.update(eliminationRoundChecksTable).set({ isActive: false });
  await db.insert(eliminationRoundStateTable).values({ lastResetAt: new Date() });
  res.json({ success: true });
});

export default router;
