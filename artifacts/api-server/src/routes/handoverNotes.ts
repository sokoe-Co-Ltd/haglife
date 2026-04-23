import { Router, type IRouter } from "express";
import { eq, desc, and } from "drizzle-orm";
import { db, handoverNotesTable, residentsTable, staffTable } from "@workspace/db";
import {
  CreateHandoverNoteBody,
  UpdateHandoverNoteBody,
  GetHandoverNoteParams,
  UpdateHandoverNoteParams,
  DeleteHandoverNoteParams,
  ListHandoverNotesQueryParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

async function withNames(note: typeof handoverNotesTable.$inferSelect) {
  let residentName: string | null = null;
  let authorName: string | null = null;
  if (note.residentId) {
    const [r] = await db.select().from(residentsTable).where(eq(residentsTable.id, note.residentId));
    if (r) residentName = `${r.lastName}${r.firstName}`;
  }
  if (note.authorId) {
    const [s] = await db.select().from(staffTable).where(eq(staffTable.id, note.authorId));
    if (s) authorName = `${s.lastName}${s.firstName}`;
  }
  return { ...note, residentName, authorName };
}

router.get("/handover-notes", async (req, res): Promise<void> => {
  const query = ListHandoverNotesQueryParams.safeParse(req.query);
  const conditions = [];
  if (query.success && query.data.resident_id != null) {
    conditions.push(eq(handoverNotesTable.residentId, query.data.resident_id));
  }
  if (query.success && query.data.is_doctor_report != null) {
    conditions.push(eq(handoverNotesTable.isDoctorReport, query.data.is_doctor_report));
  }
  const limit = (query.success && query.data.limit) ? query.data.limit : 50;
  const rows = await db
    .select()
    .from(handoverNotesTable)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(handoverNotesTable.recordedAt))
    .limit(limit);
  const result = await Promise.all(rows.map(withNames));
  res.json(result);
});

router.post("/handover-notes", async (req, res): Promise<void> => {
  const parsed = CreateHandoverNoteBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const data = {
    ...parsed.data,
    recordedAt: parsed.data.recordedAt ? new Date(parsed.data.recordedAt) : new Date(),
  };
  const [note] = await db.insert(handoverNotesTable).values(data).returning();
  const result = await withNames(note);
  res.status(201).json(result);
});

router.get("/handover-notes/:id", async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = GetHandoverNoteParams.safeParse({ id: parseInt(rawId, 10) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [note] = await db
    .select()
    .from(handoverNotesTable)
    .where(eq(handoverNotesTable.id, params.data.id));
  if (!note) {
    res.status(404).json({ error: "申し送りが見つかりません" });
    return;
  }
  const result = await withNames(note);
  res.json(result);
});

router.patch("/handover-notes/:id", async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = UpdateHandoverNoteParams.safeParse({ id: parseInt(rawId, 10) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateHandoverNoteBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const updateData: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(parsed.data)) {
    if (v !== null && v !== undefined) updateData[k] = v;
  }
  const [note] = await db
    .update(handoverNotesTable)
    .set(updateData)
    .where(eq(handoverNotesTable.id, params.data.id))
    .returning();
  if (!note) {
    res.status(404).json({ error: "申し送りが見つかりません" });
    return;
  }
  const result = await withNames(note);
  res.json(result);
});

router.delete("/handover-notes/:id", async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = DeleteHandoverNoteParams.safeParse({ id: parseInt(rawId, 10) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  await db.delete(handoverNotesTable).where(eq(handoverNotesTable.id, params.data.id));
  res.sendStatus(204);
});

export default router;
