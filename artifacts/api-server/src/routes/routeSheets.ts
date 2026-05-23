import { Router, type IRouter } from "express";
import { eq, desc, inArray, asc, ne, and, notInArray } from "drizzle-orm";
import {
  db, routeSheetsTable, routeSheetRowsTable, routeSheetCellsTable, visitConflictsView,
  routeSheetTemplatesTable, routeSheetTemplateRowsTable, routeSheetTemplateCellsTable,
  shiftTypesTable, shiftsTable, staffTable,
  residentServicesTable, residentsTable, serviceTypesTable,
  routeSheetCellAuditLogTable,
} from "@workspace/db";
import { z } from "zod";

const router: IRouter = Router();

const CellInput = z.object({
  id: z.number().int().optional(),
  startTime: z.string(),
  endTime: z.string(),
  isBreak: z.boolean().default(false),
  residentName: z.string().nullable().optional(),
  serviceLabel: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  residentId: z.number().int().nullable().optional(),
  serviceTypeId: z.string().nullable().optional(),
  // 監査用フィールド（フロントは未送信でも可）
  status: z.string().nullable().optional(),
  skipReason: z.string().nullable().optional(),
  actualStaffId: z.number().int().nullable().optional(),
  modifiedNote: z.string().nullable().optional(),
  isAdHoc: z.boolean().optional(),
});

const RowInput = z.object({
  id: z.number().int().optional(),
  staffName: z.string(),
  shiftType: z.string().default("日"),
  sortOrder: z.number().int().default(0),
  staffId: z.number().int().nullable().optional(),
  cells: z.array(CellInput).default([]),
});

const UpsertBody = z.object({
  headerNote: z.string().nullable().optional(),
  dayServiceNote: z.string().nullable().optional(),
  specialNote: z.string().nullable().optional(),
  rows: z.array(RowInput).default([]),
});

type CellInputT = z.infer<typeof CellInput>;
type CellRecord = typeof routeSheetCellsTable.$inferSelect;

async function buildSheet(sheetId: number) {
  const sheet = await db.query.routeSheetsTable.findFirst({
    where: eq(routeSheetsTable.id, sheetId),
  });
  if (!sheet) return null;

  const rows = await db
    .select()
    .from(routeSheetRowsTable)
    .where(eq(routeSheetRowsTable.routeSheetId, sheetId))
    .orderBy(routeSheetRowsTable.sortOrder);

  const rowsWithCells = await Promise.all(
    rows.map(async (row) => {
      // 操作画面では status='skipped'（論理削除）のセルは非表示
      const cells = await db
        .select()
        .from(routeSheetCellsTable)
        .where(
          and(
            eq(routeSheetCellsTable.routeSheetRowId, row.id),
            ne(routeSheetCellsTable.status, "skipped")
          )
        )
        .orderBy(routeSheetCellsTable.startTime);
      return { ...row, cells };
    })
  );

  const conflicts = await db
    .select()
    .from(visitConflictsView)
    .where(eq(visitConflictsView.routeSheetId, sheetId));

  return {
    ...sheet,
    rows: rowsWithCells,
    conflicts: conflicts.map((c) => ({
      cellAId: c.cellAId,
      cellBId: c.cellBId,
      staffId: c.staffId,
      aStart: c.aStart,
      aEnd: c.aEnd,
      bStart: c.bStart,
      bEnd: c.bEnd,
    })),
  };
}

router.get("/route-sheets", async (req, res): Promise<void> => {
  const date = req.query.date as string | undefined;
  if (date) {
    const sheet = await db.query.routeSheetsTable.findFirst({
      where: eq(routeSheetsTable.date, date),
    });
    if (sheet) {
      res.json({ source: "instance", ...(await buildSheet(sheet.id)) });
      return;
    }

    // No saved instance — try to synthesize from weekday template
    const weekday = new Date(date + "T00:00:00").getDay();
    const [template] = await db
      .select()
      .from(routeSheetTemplatesTable)
      .where(eq(routeSheetTemplatesTable.weekday, weekday))
      .limit(1);

    if (!template) {
      res.json({ source: "empty", rows: [], conflicts: [] });
      return;
    }

    const tplRowsData = await db
      .select({ row: routeSheetTemplateRowsTable, shiftType: shiftTypesTable })
      .from(routeSheetTemplateRowsTable)
      .leftJoin(shiftTypesTable, eq(routeSheetTemplateRowsTable.shiftTypeId, shiftTypesTable.id))
      .where(eq(routeSheetTemplateRowsTable.templateId, template.id))
      .orderBy(asc(routeSheetTemplateRowsTable.sortOrder));

    const shiftsData = await db
      .select({ shift: shiftsTable, staff: staffTable })
      .from(shiftsTable)
      .leftJoin(staffTable, eq(shiftsTable.staffId, staffTable.id))
      .where(eq(shiftsTable.date, date));

    const tplRowIds = tplRowsData.map(({ row }) => row.id);
    const tplCellsWithDetails = tplRowIds.length === 0 ? [] : await db
      .select({
        cell: routeSheetTemplateCellsTable,
        residentService: residentServicesTable,
        resident: residentsTable,
        serviceType: serviceTypesTable,
      })
      .from(routeSheetTemplateCellsTable)
      .leftJoin(residentServicesTable, eq(routeSheetTemplateCellsTable.residentServiceId, residentServicesTable.id))
      .leftJoin(residentsTable, eq(residentServicesTable.residentId, residentsTable.id))
      .leftJoin(serviceTypesTable, eq(residentServicesTable.serviceTypeId, serviceTypesTable.id))
      .where(inArray(routeSheetTemplateCellsTable.templateRowId, tplRowIds));

    const cellsByRowId = new Map<string, Array<Record<string, unknown>>>();
    for (const { cell, residentService, resident, serviceType } of tplCellsWithDetails) {
      if (residentService) {
        if (resident?.movedOutAt) continue;
        if (resident?.hospitalizedAt) continue;
        if (residentService.terminatedAt) continue;
      }
      const cellData = {
        id: `tpl-${cell.id}`,
        routeSheetRowId: cell.templateRowId,
        startTime: cell.startTime,
        endTime: cell.endTime,
        isBreak: cell.isBreak,
        residentId: residentService?.residentId ?? null,
        residentName: resident ? `${resident.lastName} ${resident.firstName}` : null,
        serviceTypeId: residentService?.serviceTypeId ?? null,
        serviceLabel: serviceType?.shortLabel ?? null,
        notes: cell.notes,
      };
      if (!cellsByRowId.has(cell.templateRowId)) {
        cellsByRowId.set(cell.templateRowId, []);
      }
      cellsByRowId.get(cell.templateRowId)!.push(cellData);
    }

    const synthesizedRows = tplRowsData.map(({ row: tplRow, shiftType }) => {
      const match = shiftsData.find(
        (s) => s.shift.shiftTypeId === tplRow.shiftTypeId && s.shift.slotLabel === tplRow.slotLabel
      );
      return {
        sortOrder: tplRow.sortOrder,
        shiftType: shiftType?.code ?? "日",
        staffId: match?.shift.staffId ?? null,
        staffName: match?.staff ? `${match.staff.lastName} ${match.staff.firstName}` : "",
        cells: cellsByRowId.get(tplRow.id) ?? [],
      };
    });

    res.json({
      source: "template",
      templateId: template.id,
      weekday: template.weekday,
      rows: synthesizedRows,
      conflicts: [],
    });
    return;
  }

  const sheets = await db
    .select({ id: routeSheetsTable.id, date: routeSheetsTable.date })
    .from(routeSheetsTable)
    .orderBy(desc(routeSheetsTable.date))
    .limit(90);
  res.json(sheets);
});

router.get("/route-sheets/:date", async (req, res): Promise<void> => {
  const { date } = req.params;
  const sheet = await db.query.routeSheetsTable.findFirst({
    where: eq(routeSheetsTable.date, date),
  });
  if (!sheet) {
    res.json(null);
    return;
  }
  res.json(await buildSheet(sheet.id));
});

// ── status 自動推定 ────────────────────────────────────────────
function computeStatus(before: CellRecord | null, input: CellInputT): string {
  // 明示的に skipped が指定されている場合はそれを優先
  if (input.status === "skipped") return "skipped";
  if (input.status === "added") return "added";

  // 新規セル（before なし）= 計画外の追加
  if (!before) return "added";

  // 計画スナップショットがあるなら差分検出
  const planned = {
    startTime: before.plannedStartTime,
    endTime: before.plannedEndTime,
    serviceTypeId: before.plannedServiceTypeId,
  };
  // planned* が一つも入っていない（古いデータ）→ 比較不能、現状維持
  if (
    planned.startTime === null &&
    planned.endTime === null &&
    planned.serviceTypeId === null
  ) {
    return before.status === "planned" ? "done" : before.status;
  }

  const isModified =
    (planned.startTime ?? before.startTime) !== input.startTime ||
    (planned.endTime ?? before.endTime) !== input.endTime ||
    (planned.serviceTypeId ?? before.serviceTypeId) !== (input.serviceTypeId ?? null);

  return isModified ? "modified" : "done";
}

function determineAction(
  before: CellRecord | null,
  newStatus: string,
  newStaffReassigned: boolean,
  isAdHoc: boolean
): string {
  if (!before) return isAdHoc ? "add_adhoc" : "create";
  if (newStatus === "skipped" && before.status !== "skipped") return "skip";
  if (newStatus !== "skipped" && before.status === "skipped") return "unskip";
  if (!before.staffReassigned && newStaffReassigned) return "reassign";
  return "update";
}

router.put("/route-sheets/:date", async (req, res): Promise<void> => {
  const { date } = req.params;
  const parsed = UpsertBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { rows, ...sheetData } = parsed.data;

  let sheetId: number;
  const existing = await db.query.routeSheetsTable.findFirst({
    where: eq(routeSheetsTable.date, date),
  });

  if (existing) {
    await db.update(routeSheetsTable).set({
      ...sheetData,
      updatedAt: new Date(),
    }).where(eq(routeSheetsTable.id, existing.id));
    sheetId = existing.id;
  } else {
    const [created] = await db.insert(routeSheetsTable).values({ date, ...sheetData }).returning();
    sheetId = created.id;
  }

  // === 既存の rows / cells を取得（差分判定用） ===
  const existingRows = await db
    .select()
    .from(routeSheetRowsTable)
    .where(eq(routeSheetRowsTable.routeSheetId, sheetId));
  const existingRowIds = existingRows.map((r) => r.id);
  const existingCells = existingRowIds.length === 0
    ? []
    : await db
        .select()
        .from(routeSheetCellsTable)
        .where(inArray(routeSheetCellsTable.routeSheetRowId, existingRowIds));
  const existingCellsById = new Map(existingCells.map((c) => [c.id, c]));

  // payload に含まれている cell.id を集める（残存セル）
  const keptCellIds = new Set<number>();

  // 監査ログ用バッファ
  const auditLogs: Array<typeof routeSheetCellAuditLogTable.$inferInsert> = [];

  // === Row 差分マージ ===
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    let rowId: number;

    if (row.id && existingRowIds.includes(row.id)) {
      // UPDATE 既存行
      await db.update(routeSheetRowsTable)
        .set({
          staffName: row.staffName,
          shiftType: row.shiftType,
          sortOrder: row.sortOrder ?? i,
          staffId: row.staffId ?? null,
        })
        .where(eq(routeSheetRowsTable.id, row.id));
      rowId = row.id;
    } else {
      // INSERT 新規行
      const [inserted] = await db.insert(routeSheetRowsTable).values({
        routeSheetId: sheetId,
        staffName: row.staffName,
        shiftType: row.shiftType,
        sortOrder: row.sortOrder ?? i,
        staffId: row.staffId ?? null,
      }).returning();
      rowId = inserted.id;
    }

    // === Cell 差分マージ ===
    for (const cell of row.cells) {
      const before = cell.id ? (existingCellsById.get(cell.id) ?? null) : null;
      const actualStaffId = cell.actualStaffId ?? row.staffId ?? null;
      const plannedStaffId = before?.plannedStaffId ?? null;
      const newStaffReassigned =
        plannedStaffId !== null &&
        actualStaffId !== null &&
        plannedStaffId !== actualStaffId;
      const newStatus = computeStatus(before, cell);
      const isAdHoc = before ? before.isAdHoc : (cell.isAdHoc ?? !cell.id);

      const baseFields = {
        routeSheetRowId: rowId,
        startTime: cell.startTime,
        endTime: cell.endTime,
        isBreak: cell.isBreak,
        residentName: cell.residentName ?? null,
        serviceLabel: cell.serviceLabel ?? null,
        notes: cell.notes ?? null,
        residentId: cell.residentId ?? null,
        serviceTypeId: cell.serviceTypeId ?? null,
        status: newStatus,
        skipReason: cell.skipReason ?? null,
        actualStaffId,
        staffReassigned: newStaffReassigned,
        modifiedNote: cell.modifiedNote ?? before?.modifiedNote ?? null,
        isAdHoc,
        modifiedAt: new Date(),
        modifiedBy: null as number | null,
      };

      let savedCellId: number;
      if (before) {
        // UPDATE
        await db.update(routeSheetCellsTable)
          .set(baseFields)
          .where(eq(routeSheetCellsTable.id, before.id));
        savedCellId = before.id;
        keptCellIds.add(before.id);
      } else {
        // INSERT — 新規セルは計画外（isAdHoc=true, status='added' 推奨）
        const [inserted] = await db.insert(routeSheetCellsTable)
          .values({
            ...baseFields,
            status: newStatus === "done" ? "added" : newStatus, // 比較対象無いので added 固定
            isAdHoc: true,
            // planned* は新規セルでは null 維持
          })
          .returning();
        savedCellId = inserted.id;
        keptCellIds.add(savedCellId);
      }

      // 監査ログ：意味のある差分があるときだけ書く
      const action = determineAction(before, newStatus, newStaffReassigned, isAdHoc);
      const isMeaningfulChange =
        !before ||
        before.status !== newStatus ||
        before.staffReassigned !== newStaffReassigned ||
        before.startTime !== cell.startTime ||
        before.endTime !== cell.endTime ||
        before.serviceTypeId !== (cell.serviceTypeId ?? null) ||
        before.residentId !== (cell.residentId ?? null) ||
        (before.modifiedNote ?? null) !== (cell.modifiedNote ?? before.modifiedNote ?? null);
      if (isMeaningfulChange) {
        auditLogs.push({
          cellId: savedCellId,
          actorStaffId: null,
          action,
          beforeJson: before ?? null,
          afterJson: { id: savedCellId, ...baseFields },
          reason: cell.skipReason ?? cell.modifiedNote ?? null,
        });
      }
    }
  }

  // === payload に含まれなかった既存セル → status='skipped' でソフトデリート ===
  const removedCells = existingCells.filter((c) => !keptCellIds.has(c.id));
  for (const cell of removedCells) {
    if (cell.status === "skipped") continue; // 既に skipped なら何もしない
    await db.update(routeSheetCellsTable)
      .set({
        status: "skipped",
        modifiedAt: new Date(),
      })
      .where(eq(routeSheetCellsTable.id, cell.id));
    auditLogs.push({
      cellId: cell.id,
      actorStaffId: null,
      action: "skip",
      beforeJson: cell,
      afterJson: { ...cell, status: "skipped" },
      reason: null,
    });
  }

  // === payload に含まれなかった既存行 → 配下の非skippedセルを skipped 化（行自体は残す）===
  // 行を物理削除すると、その下の skipped セルが sheet からたどれなくなり監査で見えなくなるため、
  // 行は残したまま配下セルをソフトデリートする。フロント側は配下に visible セルが無い行を非表示にする想定。
  const keptRowIds = new Set<number>(
    rows.filter((r) => r.id != null).map((r) => r.id!)
  );
  const removedRowIds = existingRowIds.filter((id) => !keptRowIds.has(id));
  if (removedRowIds.length > 0) {
    const cellsUnderRemovedRows = existingCells.filter(
      (c) => removedRowIds.includes(c.routeSheetRowId) && c.status !== "skipped" && !keptCellIds.has(c.id)
    );
    for (const cell of cellsUnderRemovedRows) {
      await db.update(routeSheetCellsTable)
        .set({ status: "skipped", modifiedAt: new Date() })
        .where(eq(routeSheetCellsTable.id, cell.id));
      auditLogs.push({
        cellId: cell.id,
        actorStaffId: null,
        action: "skip",
        beforeJson: cell,
        afterJson: { ...cell, status: "skipped" },
        reason: "row_removed",
      });
    }
  }

  // 監査ログを一括 INSERT
  if (auditLogs.length > 0) {
    await db.insert(routeSheetCellAuditLogTable).values(auditLogs);
  }

  res.json(await buildSheet(sheetId));
});

router.delete("/route-sheets/:date", async (req, res): Promise<void> => {
  const { date } = req.params;
  const sheet = await db.query.routeSheetsTable.findFirst({
    where: eq(routeSheetsTable.date, date),
  });
  if (!sheet) {
    res.status(404).json({ error: "ルート票が見つかりません" });
    return;
  }
  await db.delete(routeSheetsTable).where(eq(routeSheetsTable.id, sheet.id));
  res.sendStatus(204);
});

export default router;

// Suppress unused import (kept for potential future use)
void notInArray;
