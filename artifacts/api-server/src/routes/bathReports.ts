import { Router, type IRouter } from "express";
import { eq, desc, and, gte, lte } from "drizzle-orm";
import { db, bathReportsTable, residentsTable, staffTable } from "@workspace/db";
import {
  CreateBathReportBody,
  UpdateBathReportBody,
  UpdateBathReportParams,
  DeleteBathReportParams,
  ListBathReportsQueryParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

function todayRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  return { start, end };
}

async function withNames(report: typeof bathReportsTable.$inferSelect) {
  let residentName: string | null = null;
  let staffName: string | null = null;
  if (report.residentId) {
    const [r] = await db.select().from(residentsTable).where(eq(residentsTable.id, report.residentId));
    if (r) residentName = `${r.lastName}${r.firstName}`;
  }
  if (report.staffId) {
    const [s] = await db.select().from(staffTable).where(eq(staffTable.id, report.staffId));
    if (s) staffName = `${s.lastName}${s.firstName}`;
  }
  return {
    ...report,
    temperature: report.temperature ? parseFloat(String(report.temperature)) : null,
    residentName,
    staffName,
  };
}

router.get("/bath-reports", async (req, res): Promise<void> => {
  const query = ListBathReportsQueryParams.safeParse(req.query);
  const conditions = [];
  if (query.success && query.data.resident_id != null) {
    conditions.push(eq(bathReportsTable.residentId, query.data.resident_id));
  }
  if (query.success && query.data.today_only) {
    const { start, end } = todayRange();
    conditions.push(gte(bathReportsTable.recordedAt, start));
    conditions.push(lte(bathReportsTable.recordedAt, end));
  }
  const rows = await db
    .select()
    .from(bathReportsTable)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(bathReportsTable.recordedAt));
  const result = await Promise.all(rows.map(withNames));
  res.json(result);
});

router.post("/bath-reports", async (req, res): Promise<void> => {
  const parsed = CreateBathReportBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const data = {
    ...parsed.data,
    recordedAt: parsed.data.recordedAt ? new Date(parsed.data.recordedAt) : new Date(),
    temperature: parsed.data.temperature != null ? String(parsed.data.temperature) : null,
  };
  const [report] = await db.insert(bathReportsTable).values(data).returning();
  const result = await withNames(report);
  res.status(201).json(result);
});

router.patch("/bath-reports/:id", async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = UpdateBathReportParams.safeParse({ id: parseInt(rawId, 10) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateBathReportBody.safeParse(req.body);
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
  const [report] = await db
    .update(bathReportsTable)
    .set(updateData)
    .where(eq(bathReportsTable.id, params.data.id))
    .returning();
  if (!report) {
    res.status(404).json({ error: "入浴報告が見つかりません" });
    return;
  }
  const result = await withNames(report);
  res.json(result);
});

router.delete("/bath-reports/:id", async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = DeleteBathReportParams.safeParse({ id: parseInt(rawId, 10) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  await db.delete(bathReportsTable).where(eq(bathReportsTable.id, params.data.id));
  res.sendStatus(204);
});

export default router;
