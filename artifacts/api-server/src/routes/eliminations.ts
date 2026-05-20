import { Router, type IRouter } from "express";
import { eq, desc, and, gte, lt } from "drizzle-orm";
import { db, eliminationsTable, eliminationRoundChecksTable, eliminationRoundStateTable, eliminationBackChecksTable, residentsTable } from "@workspace/db";
import {
  CreateEliminationBody,
  DeleteEliminationParams,
  ListEliminationsQueryParams,
  CheckEliminationRoundBody,
} from "@workspace/api-zod";
const router: IRouter = Router();

function toJSTDateString(d: Date): string {
  return d.toLocaleDateString("sv-SE", { timeZone: "Asia/Tokyo" });
}

function jstDayStart(dateStr: string): Date {
  return new Date(`${dateStr}T00:00:00+09:00`);
}
function jstDayEnd(dateStr: string): Date {
  return new Date(`${dateStr}T23:59:59.999+09:00`);
}

router.get("/eliminations", async (req, res): Promise<void> => {
  const query = ListEliminationsQueryParams.safeParse(req.query);
  const conditions = [];
  if (query.success && query.data.resident_id != null) {
    conditions.push(eq(eliminationsTable.residentId, query.data.resident_id));
  }
  const [rows, residents] = await Promise.all([
    db.select().from(eliminationsTable)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(eliminationsTable.recordedAt)),
    db.select({ id: residentsTable.id, lastName: residentsTable.lastName, firstName: residentsTable.firstName })
      .from(residentsTable),
  ]);
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

router.patch("/eliminations/:id", async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(rawId, 10);
  if (isNaN(id)) { res.status(400).json({ error: "invalid id" }); return; }
  const { type, amount, notes, recordedAt } = req.body;
  const updateData: Record<string, unknown> = {};
  if (type !== undefined) updateData.type = type;
  if (amount !== undefined) updateData.amount = amount;
  if (notes !== undefined) updateData.notes = notes;
  if (recordedAt !== undefined) updateData.recordedAt = new Date(recordedAt);
  if (Object.keys(updateData).length === 0) { res.status(400).json({ error: "no fields" }); return; }
  const [row] = await db.update(eliminationsTable).set(updateData).where(eq(eliminationsTable.id, id)).returning();
  if (!row) { res.status(404).json({ error: "not found" }); return; }
  res.json(row);
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
  const dateParam = typeof req.query.date === "string" ? req.query.date : null;
  const todayJST = toJSTDateString(new Date());
  const isToday = !dateParam || dateParam === todayJST;
  const targetDate = dateParam || todayJST;

  const residents = await db
    .select()
    .from(residentsTable)
    .where(eq(residentsTable.isVisible, true))
    .orderBy(residentsTable.roomNumber);

  let roundChecks: { residentId: number }[] = [];

  if (isToday) {
    const [state] = await db.select().from(eliminationRoundStateTable).orderBy(desc(eliminationRoundStateTable.lastResetAt)).limit(1);
    const resetAt = state?.lastResetAt ?? new Date(0);
    roundChecks = await db
      .select({ residentId: eliminationRoundChecksTable.residentId })
      .from(eliminationRoundChecksTable)
      .where(and(eq(eliminationRoundChecksTable.isActive, true), gte(eliminationRoundChecksTable.checkedAt, resetAt)));
  } else {
    roundChecks = await db
      .select({ residentId: eliminationRoundChecksTable.residentId })
      .from(eliminationRoundChecksTable)
      .where(
        and(
          gte(eliminationRoundChecksTable.checkedAt, jstDayStart(targetDate)),
          lt(eliminationRoundChecksTable.checkedAt, jstDayEnd(targetDate)),
        )
      );
  }

  const allBm = await db
    .select()
    .from(eliminationsTable)
    .where(eq(eliminationsTable.type, "便"))
    .orderBy(desc(eliminationsTable.recordedAt));

  const lastBmMap = new Map<number, Date>();
  for (const e of allBm) {
    if (!lastBmMap.has(e.residentId)) lastBmMap.set(e.residentId, e.recordedAt);
  }

  const allBackChecks = await db
    .select()
    .from(eliminationBackChecksTable)
    .orderBy(desc(eliminationBackChecksTable.checkedAt));

  const lastBackCheckMap = new Map<number, Date>();
  for (const b of allBackChecks) {
    if (!lastBackCheckMap.has(b.residentId)) lastBackCheckMap.set(b.residentId, b.checkedAt);
  }

  const now = new Date();
  const result = residents.map(r => {
    const lastBm = lastBmMap.get(r.id);
    const daysSinceLastBm = lastBm
      ? Math.floor((now.getTime() - lastBm.getTime()) / (1000 * 60 * 60 * 24))
      : null;
    const checkedThisRound = roundChecks.some(c => c.residentId === r.id);
    const needsAttention = !r.stomaManagement && (daysSinceLastBm === null || daysSinceLastBm >= 3);

    const lastBackCheck = lastBackCheckMap.get(r.id);
    const daysSinceLastBackCheck = lastBackCheck
      ? Math.floor((now.getTime() - lastBackCheck.getTime()) / (1000 * 60 * 60 * 24))
      : null;

    return {
      residentId: r.id,
      residentName: `${r.lastName}${r.firstName}`,
      roomNumber: r.roomNumber,
      photoUrl: r.photoUrl ?? null,
      birthMonth: r.birthMonth,
      birthDay: r.birthDay,
      stomaManagement: r.stomaManagement,
      lastBmRecordedAt: lastBm ? lastBm.toISOString() : null,
      daysSinceLastBm,
      checkedThisRound,
      needsAttention,
      lastBackCheckAt: lastBackCheck ? lastBackCheck.toISOString() : null,
      daysSinceLastBackCheck,
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
  const now = new Date();
  await Promise.all([
    db.insert(eliminationRoundChecksTable).values({
      residentId: parsed.data.residentId,
      staffId: parsed.data.staffId ?? null,
      checkedAt: now,
      roundResetAt: resetAt,
      isActive: true,
    }),
    db.insert(eliminationBackChecksTable).values({
      residentId: parsed.data.residentId,
      checkedAt: now,
      notes: null,
    }),
  ]);
  res.json({ success: true });
});

router.post("/eliminations/rounds/reset", async (_req, res): Promise<void> => {
  await db.update(eliminationRoundChecksTable).set({ isActive: false });
  await db.insert(eliminationRoundStateTable).values({ lastResetAt: new Date() });
  res.json({ success: true });
});

router.get("/eliminations/back-checks", async (req, res): Promise<void> => {
  const residentIdParam = req.query.resident_id;
  const rows = await db
    .select()
    .from(eliminationBackChecksTable)
    .where(
      residentIdParam
        ? eq(eliminationBackChecksTable.residentId, parseInt(residentIdParam as string, 10))
        : undefined
    )
    .orderBy(desc(eliminationBackChecksTable.checkedAt));
  res.json(rows);
});

router.post("/eliminations/back-checks", async (req, res): Promise<void> => {
  const { residentId, notes } = req.body;
  if (!residentId || typeof residentId !== "number") {
    res.status(400).json({ error: "residentId is required" });
    return;
  }
  const [row] = await db
    .insert(eliminationBackChecksTable)
    .values({ residentId, notes: notes ?? null })
    .returning();
  res.status(201).json(row);
});

export default router;
