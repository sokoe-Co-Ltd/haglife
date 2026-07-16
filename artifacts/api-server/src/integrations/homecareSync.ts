/**
 * homecare のルート表を取得 → 写像 → route_sheet へ取り込む同期関数。
 *
 * HTTP ルート（routes/homecareIntegration.ts）と定期実行スクリプト
 * （scripts/syncHomecareRoutes.ts）の両方から使う。写像の設計判断は
 * homecareRouteMapper.ts のヘッダを参照。
 *
 * 安全策:
 *   - dryRun（既定 true 呼び出しを推奨）では DB に一切書かない。
 *   - その日の route_sheet が既にある場合は上書きせず kind:'exists' を返す
 *     （materialize 済み/編集済みを保護）。再取り込みは既存シート削除後に。
 *   - 書き込みはトランザクション（失敗時ロールバック）。
 */

import { eq } from "drizzle-orm";
import {
  db,
  routeSheetsTable,
  routeSheetRowsTable,
  routeSheetCellsTable,
} from "@workspace/db";

import { fetchHomecareRoutes } from "./homecareClient";
import { mapHomecareRoutesToSheetPlan, type SheetPlan } from "./homecareRouteMapper";

export type SyncHomecareResult =
  | { kind: "dryRun"; date: string; plan: SheetPlan }
  | { kind: "exists"; date: string; routeSheetId: number }
  | {
      kind: "imported";
      date: string;
      routeSheetId: number;
      rowCount: number;
      cellCount: number;
    };

/**
 * 指定日の homecare ルートを取り込む。
 * @param date  YYYY-MM-DD
 * @param opts.dryRun  true（既定）: 書かずに写像プランを返す。
 * @throws HomecareApiError  homecare 側の設定不足/認証/レート/通信エラー時
 */
export async function syncHomecareRouteForDate(
  date: string,
  opts: { dryRun?: boolean } = {},
): Promise<SyncHomecareResult> {
  const dryRun = opts.dryRun ?? true;

  const homecare = await fetchHomecareRoutes(date);
  const plan = mapHomecareRoutesToSheetPlan(homecare);

  if (dryRun) {
    return { kind: "dryRun", date, plan };
  }

  // 既存シート保護: その日の route_sheet があれば上書きしない
  const existing = await db.query.routeSheetsTable.findFirst({
    where: eq(routeSheetsTable.date, date),
  });
  if (existing) {
    return { kind: "exists", date, routeSheetId: existing.id };
  }

  const result = await db.transaction(async (tx) => {
    const [sheet] = await tx
      .insert(routeSheetsTable)
      .values({ date, materializedFromTemplateId: plan.source })
      .returning();

    let cellCount = 0;
    for (const row of plan.rows) {
      const [insertedRow] = await tx
        .insert(routeSheetRowsTable)
        .values({
          routeSheetId: sheet!.id,
          staffName: row.staffName,
          shiftType: row.shiftType,
          sortOrder: row.sortOrder,
          staffId: row.staffId,
        })
        .returning();

      if (row.cells.length > 0) {
        await tx.insert(routeSheetCellsTable).values(
          row.cells.map((c) => ({
            routeSheetRowId: insertedRow!.id,
            startTime: c.startTime,
            endTime: c.endTime,
            isBreak: c.isBreak,
            residentName: c.residentName,
            serviceLabel: c.serviceLabel,
            notes: c.notes,
            status: c.status,
          })),
        );
        cellCount += row.cells.length;
      }
    }
    return { routeSheetId: sheet!.id, cellCount };
  });

  return {
    kind: "imported",
    date,
    routeSheetId: result.routeSheetId,
    rowCount: plan.rows.length,
    cellCount: result.cellCount,
  };
}
