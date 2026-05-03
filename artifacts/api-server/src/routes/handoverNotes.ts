import { Router, type IRouter } from "express";
import { eq, desc, and, gte, lte } from "drizzle-orm";
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
  const [residents, staff] = await Promise.all([
    note.residentId
      ? db.select({ id: residentsTable.id, lastName: residentsTable.lastName, firstName: residentsTable.firstName })
          .from(residentsTable).where(eq(residentsTable.id, note.residentId))
      : Promise.resolve([]),
    note.authorId
      ? db.select({ id: staffTable.id, lastName: staffTable.lastName, firstName: staffTable.firstName })
          .from(staffTable).where(eq(staffTable.id, note.authorId))
      : Promise.resolve([]),
  ]);
  const r = residents[0];
  const s = staff[0];
  return {
    ...note,
    residentName: r ? `${r.lastName}${r.firstName}` : null,
    authorName: s ? `${s.lastName}${s.firstName}` : null,
  };
}

async function withNamesBulk(notes: (typeof handoverNotesTable.$inferSelect)[]) {
  if (notes.length === 0) return [];
  const [residents, staffRows] = await Promise.all([
    db.select({ id: residentsTable.id, lastName: residentsTable.lastName, firstName: residentsTable.firstName })
      .from(residentsTable),
    db.select({ id: staffTable.id, lastName: staffTable.lastName, firstName: staffTable.firstName })
      .from(staffTable),
  ]);
  const rMap = new Map(residents.map(r => [r.id, `${r.lastName}${r.firstName}`]));
  const sMap = new Map(staffRows.map(s => [s.id, `${s.lastName}${s.firstName}`]));
  return notes.map(n => ({
    ...n,
    residentName: n.residentId ? (rMap.get(n.residentId) ?? null) : null,
    authorName: n.authorId ? (sMap.get(n.authorId) ?? null) : null,
  }));
}

function dayRange(dateStr?: string | null) {
  const d = dateStr ? new Date(dateStr) : new Date();
  const start = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
  const end = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
  return { start, end };
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
  if (query.success && query.data.today_only) {
    const { start, end } = dayRange();
    conditions.push(gte(handoverNotesTable.recordedAt, start));
    conditions.push(lte(handoverNotesTable.recordedAt, end));
  } else if (query.success && query.data.year_month) {
    const [y, m] = query.data.year_month.split("-").map(Number);
    const start = new Date(y, m - 1, 1, 0, 0, 0, 0);
    const end = new Date(y, m, 0, 23, 59, 59, 999);
    conditions.push(gte(handoverNotesTable.recordedAt, start));
    conditions.push(lte(handoverNotesTable.recordedAt, end));
  } else if (query.success && query.data.date) {
    const { start, end } = dayRange(query.data.date);
    conditions.push(gte(handoverNotesTable.recordedAt, start));
    conditions.push(lte(handoverNotesTable.recordedAt, end));
  }
  const limit = (query.success && query.data.limit) ? query.data.limit : 100;
  const rows = await db
    .select()
    .from(handoverNotesTable)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(handoverNotesTable.recordedAt))
    .limit(limit);
  const result = await withNamesBulk(rows);
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
