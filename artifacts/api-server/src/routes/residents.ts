import { Router, type IRouter } from "express";
import { eq, desc } from "drizzle-orm";
import { db, residentsTable, vitalsTable, mealsTable, weightsTable, eliminationsTable, handoverNotesTable } from "@workspace/db";
import {
  CreateResidentBody,
  UpdateResidentBody,
  GetResidentParams,
  UpdateResidentParams,
  DeleteResidentParams,
  GetResidentHealthSummaryParams,
  ListResidentsQueryParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/residents", async (req, res): Promise<void> => {
  const query = ListResidentsQueryParams.safeParse(req.query);
  const rows = await db
    .select()
    .from(residentsTable)
    .where(
      query.success && query.data.visible_only
        ? eq(residentsTable.isVisible, true)
        : undefined,
    )
    .orderBy(residentsTable.roomNumber);
  res.json(rows);
});

router.post("/residents", async (req, res): Promise<void> => {
  const parsed = CreateResidentBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [resident] = await db
    .insert(residentsTable)
    .values(parsed.data)
    .returning();
  res.status(201).json(resident);
});

router.get("/residents/:id", async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = GetResidentParams.safeParse({ id: parseInt(rawId, 10) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [resident] = await db
    .select()
    .from(residentsTable)
    .where(eq(residentsTable.id, params.data.id));
  if (!resident) {
    res.status(404).json({ error: "利用者が見つかりません" });
    return;
  }
  res.json(resident);
});

router.patch("/residents/:id", async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = UpdateResidentParams.safeParse({ id: parseInt(rawId, 10) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateResidentBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const updateData: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(parsed.data)) {
    if (v !== null && v !== undefined) updateData[k] = v;
  }
  const [resident] = await db
    .update(residentsTable)
    .set({ ...updateData, updatedAt: new Date() })
    .where(eq(residentsTable.id, params.data.id))
    .returning();
  if (!resident) {
    res.status(404).json({ error: "利用者が見つかりません" });
    return;
  }
  res.json(resident);
});

router.delete("/residents/:id", async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = DeleteResidentParams.safeParse({ id: parseInt(rawId, 10) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  await db.delete(residentsTable).where(eq(residentsTable.id, params.data.id));
  res.sendStatus(204);
});

router.get("/residents/:id/health-summary", async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = GetResidentHealthSummaryParams.safeParse({ id: parseInt(rawId, 10) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [resident] = await db
    .select()
    .from(residentsTable)
    .where(eq(residentsTable.id, params.data.id));
  if (!resident) {
    res.status(404).json({ error: "利用者が見つかりません" });
    return;
  }
  const recentVitals = await db
    .select()
    .from(vitalsTable)
    .where(eq(vitalsTable.residentId, params.data.id))
    .orderBy(desc(vitalsTable.recordedAt))
    .limit(30);
  const recentMeals = await db
    .select()
    .from(mealsTable)
    .where(eq(mealsTable.residentId, params.data.id))
    .orderBy(desc(mealsTable.recordedAt))
    .limit(30);
  const recentWeights = await db
    .select()
    .from(weightsTable)
    .where(eq(weightsTable.residentId, params.data.id))
    .orderBy(desc(weightsTable.recordedAt))
    .limit(10);
  const recentEliminations = await db
    .select()
    .from(eliminationsTable)
    .where(eq(eliminationsTable.residentId, params.data.id))
    .orderBy(desc(eliminationsTable.recordedAt))
    .limit(30);
  const doctorReportNotes = await db
    .select()
    .from(handoverNotesTable)
    .where(eq(handoverNotesTable.isDoctorReport, true))
    .orderBy(desc(handoverNotesTable.recordedAt))
    .limit(20);

  const residentFullName = `${resident.lastName}${resident.firstName}`;
  res.json({
    resident: { ...resident, residentName: residentFullName },
    recentVitals: recentVitals.map(v => ({ ...v, residentName: residentFullName })),
    recentMeals: recentMeals.map(m => ({ ...m, residentName: residentFullName })),
    recentWeights: recentWeights.map(w => ({ ...w, weightKg: parseFloat(String(w.weightKg)), residentName: residentFullName })),
    recentEliminations: recentEliminations.map(e => ({ ...e, residentName: residentFullName })),
    doctorReportNotes,
  });
});

export default router;
