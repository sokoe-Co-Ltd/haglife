import { Router } from "express";
import { eq, inArray, asc, and, isNull } from "drizzle-orm";
import { z } from "zod";
import {
  db,
  routeSheetTemplatesTable,
  routeSheetTemplateRowsTable,
  routeSheetTemplateCellsTable,
  shiftsTable,
  residentServicesTable,
  residentsTable,
  routeSheetsTable,
  routeSheetRowsTable,
  routeSheetCellsTable,
} from "@workspace/db";

const router = Router();
const timeRe = /^[0-2][0-9]:[0-5][0-9]$/;

const cellSchema = z.object({
  id: z.string().uuid().optional(),
  residentServiceId: z.string().uuid().nullable().optional(),
  startTime: z.string().regex(timeRe),
  endTime: z.string().regex(timeRe),
  isBreak: z.boolean().default(false),
  notes: z.string().nullable().optional(),
});

const rowSchema = z.object({
  id: z.string().uuid().optional(),
  shiftTypeId: z.string().uuid(),
  slotLabel: z.string().default(""),
  sortOrder: z.number().int().default(0),
  cells: z.array(cellSchema).default([]),
});

const upsertSchema = z.object({
  notes: z.string().nullable().optional(),
  rows: z.array(rowSchema).default([]),
});

router.get("/route-sheet-templates", async (_req, res) => {
  const templates = await db.select().from(routeSheetTemplatesTable).orderBy(asc(routeSheetTemplatesTable.weekday));
  res.json(templates);
});

router.get("/route-sheet-templates/:weekday", async (req, res) => {
  const weekday = parseInt(req.params.weekday);
  const [template] = await db
    .select()
    .from(routeSheetTemplatesTable)
    .where(eq(routeSheetTemplatesTable.weekday, weekday))
    .limit(1);
  if (!template) return res.status(404).json({ error: "Not found" });

  const rows = await db
    .select()
    .from(routeSheetTemplateRowsTable)
    .where(eq(routeSheetTemplateRowsTable.templateId, template.id))
    .orderBy(asc(routeSheetTemplateRowsTable.sortOrder));
  const rowIds = rows.map((r) => r.id);
  const cells = rowIds.length
    ? await db
        .select()
        .from(routeSheetTemplateCellsTable)
        .where(inArray(routeSheetTemplateCellsTable.templateRowId, rowIds))
    : [];

  res.json({ template, rows, cells });
});

router.put("/route-sheet-templates/:weekday", async (req, res) => {
  const weekday = parseInt(req.params.weekday);
  const parsed = upsertSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.format() });

  await db.transaction(async (tx) => {
    const [template] = await tx
      .select()
      .from(routeSheetTemplatesTable)
      .where(eq(routeSheetTemplatesTable.weekday, weekday))
      .limit(1);
    if (!template) throw new Error("Template not found");

    await tx
      .update(routeSheetTemplatesTable)
      .set({ notes: parsed.data.notes ?? null, updatedAt: new Date() })
      .where(eq(routeSheetTemplatesTable.id, template.id));

    await tx
      .delete(routeSheetTemplateRowsTable)
      .where(eq(routeSheetTemplateRowsTable.templateId, template.id));

    for (const row of parsed.data.rows) {
      const [insertedRow] = await tx
        .insert(routeSheetTemplateRowsTable)
        .values({
          templateId: template.id,
          shiftTypeId: row.shiftTypeId,
          slotLabel: row.slotLabel,
          sortOrder: row.sortOrder,
        })
        .returning();
      if (row.cells.length > 0) {
        await tx.insert(routeSheetTemplateCellsTable).values(
          row.cells.map((c) => ({
            templateRowId: insertedRow.id,
            residentServiceId: c.residentServiceId ?? null,
            startTime: c.startTime,
            endTime: c.endTime,
            isBreak: c.isBreak,
            notes: c.notes ?? null,
          }))
        );
      }
    }
  });

  res.json({ ok: true });
});

// ── materialize: テンプレから当日シートを作成 ──
router.post("/route-sheets/:date/from-template", async (req, res) => {
  const { date } = req.params;
  const weekday = new Date(date + "T00:00:00").getDay();

  const [existing] = await db
    .select()
    .from(routeSheetsTable)
    .where(eq(routeSheetsTable.date, date))
    .limit(1);
  if (existing) return res.status(400).json({ error: "Sheet already exists for this date" });

  const [template] = await db
    .select()
    .from(routeSheetTemplatesTable)
    .where(eq(routeSheetTemplatesTable.weekday, weekday))
    .limit(1);
  if (!template) return res.status(404).json({ error: "No template for this weekday" });

  const tplRows = await db
    .select()
    .from(routeSheetTemplateRowsTable)
    .where(eq(routeSheetTemplateRowsTable.templateId, template.id))
    .orderBy(asc(routeSheetTemplateRowsTable.sortOrder));
  const tplRowIds = tplRows.map((r) => r.id);
  const tplCells = tplRowIds.length
    ? await db
        .select()
        .from(routeSheetTemplateCellsTable)
        .where(inArray(routeSheetTemplateCellsTable.templateRowId, tplRowIds))
    : [];

  const shiftsToday = await db
    .select()
    .from(shiftsTable)
    .where(eq(shiftsTable.date, date));

  await db.transaction(async (tx) => {
    const [sheet] = await tx
      .insert(routeSheetsTable)
      .values({
        date,
        materializedFromTemplateId: template.id,
        materializedAt: new Date(),
      })
      .returning();

    const rowIdMap = new Map<string, number>();

    for (const tplRow of tplRows) {
      const matchingShift = shiftsToday.find(
        (s) => s.shiftTypeId === tplRow.shiftTypeId && s.slotLabel === tplRow.slotLabel
      );
      const [newRow] = await tx
        .insert(routeSheetRowsTable)
        .values({
          routeSheetId: sheet.id,
          staffId: matchingShift?.staffId ?? null,
          staffName: "",
          shiftType: "日",
          sortOrder: tplRow.sortOrder,
        })
        .returning();
      rowIdMap.set(tplRow.id, newRow.id);
    }

    const tplResidentServiceIds = tplCells
      .map((c) => c.residentServiceId)
      .filter(Boolean) as string[];
    const services = tplResidentServiceIds.length
      ? await tx
          .select({ rs: residentServicesTable, r: residentsTable })
          .from(residentServicesTable)
          .innerJoin(residentsTable, eq(residentServicesTable.residentId, residentsTable.id))
          .where(inArray(residentServicesTable.id, tplResidentServiceIds))
      : [];
    const serviceMap = new Map(services.map(({ rs, r }) => [rs.id, { rs, r }]));

    for (const tplCell of tplCells) {
      const linked = tplCell.residentServiceId ? serviceMap.get(tplCell.residentServiceId) : null;
      if (
        tplCell.residentServiceId &&
        (!linked || linked.r.movedOutAt || linked.r.hospitalizedAt || linked.rs.terminatedAt)
      ) {
        continue;
      }
      const rowId = rowIdMap.get(tplCell.templateRowId);
      if (!rowId) continue;
      await tx.insert(routeSheetCellsTable).values({
        routeSheetRowId: rowId,
        startTime: tplCell.startTime,
        endTime: tplCell.endTime,
        isBreak: tplCell.isBreak,
        residentId: linked?.rs.residentId ?? null,
        residentName: linked ? `${linked.r.lastName} ${linked.r.firstName}` : null,
        serviceTypeId: linked?.rs.serviceTypeId ?? null,
        serviceLabel: null,
        notes: tplCell.notes,
      });
    }
  });

  res.status(201).json({ ok: true });
});

// ── save-as-template: 当日シートをテンプレとして保存 ──
router.post("/route-sheets/:date/save-as-template", async (req, res) => {
  const { date } = req.params;
  const weekday = new Date(date + "T00:00:00").getDay();

  const [sheet] = await db
    .select()
    .from(routeSheetsTable)
    .where(eq(routeSheetsTable.date, date))
    .limit(1);
  if (!sheet) return res.status(404).json({ error: "No sheet for this date" });

  const rows = await db
    .select()
    .from(routeSheetRowsTable)
    .where(eq(routeSheetRowsTable.routeSheetId, sheet.id))
    .orderBy(asc(routeSheetRowsTable.sortOrder));
  const rowIds = rows.map((r) => r.id);
  const cells = rowIds.length
    ? await db
        .select()
        .from(routeSheetCellsTable)
        .where(inArray(routeSheetCellsTable.routeSheetRowId, rowIds))
    : [];

  const [template] = await db
    .select()
    .from(routeSheetTemplatesTable)
    .where(eq(routeSheetTemplatesTable.weekday, weekday))
    .limit(1);
  if (!template) return res.status(404).json({ error: "No template for this weekday" });

  const shiftsOnDate = await db.select().from(shiftsTable).where(eq(shiftsTable.date, date));

  await db.transaction(async (tx) => {
    await tx
      .delete(routeSheetTemplateRowsTable)
      .where(eq(routeSheetTemplateRowsTable.templateId, template.id));

    for (const row of rows) {
      const matchingShift = row.staffId
        ? shiftsOnDate.find((s) => s.staffId === row.staffId)
        : null;
      if (!matchingShift) continue;

      const [newTplRow] = await tx
        .insert(routeSheetTemplateRowsTable)
        .values({
          templateId: template.id,
          shiftTypeId: matchingShift.shiftTypeId,
          slotLabel: matchingShift.slotLabel,
          sortOrder: row.sortOrder,
        })
        .returning();

      const rowCells = cells.filter((c) => c.routeSheetRowId === row.id);
      for (const cell of rowCells) {
        let residentServiceId: string | null = null;
        if (cell.residentId && cell.serviceTypeId) {
          const [rs] = await tx
            .select()
            .from(residentServicesTable)
            .where(
              and(
                eq(residentServicesTable.residentId, cell.residentId),
                eq(residentServicesTable.serviceTypeId, cell.serviceTypeId as any),
                isNull(residentServicesTable.terminatedAt)
              )
            )
            .limit(1);
          residentServiceId = rs?.id ?? null;
        }
        await tx.insert(routeSheetTemplateCellsTable).values({
          templateRowId: newTplRow.id,
          residentServiceId,
          startTime: cell.startTime,
          endTime: cell.endTime,
          isBreak: cell.isBreak,
          notes: cell.notes,
        });
      }
    }

    await tx
      .update(routeSheetTemplatesTable)
      .set({ updatedAt: new Date() })
      .where(eq(routeSheetTemplatesTable.id, template.id));
  });

  res.json({ ok: true });
});

export default router;
