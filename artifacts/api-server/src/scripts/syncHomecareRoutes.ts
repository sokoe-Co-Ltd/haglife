/**
 * homecare ルート表の定期取り込みスクリプト（Replit Scheduled Deployment 用）。
 *
 * 今日〜(今日+N)日ぶん（JST）を順に取り込む。1 回実行して終了する one-shot。
 * Replit の Scheduled Deployment に「1 日 1 回」等で登録して自動同期にする想定。
 *
 * 実行:
 *   HOMECARE_SYNC_DAYS=3 HOMECARE_SYNC_DRY_RUN=false \
 *   tsx artifacts/api-server/src/scripts/syncHomecareRoutes.ts
 *
 * 環境変数:
 *   HOMECARE_API_BASE_URL / HOMECARE_API_KEY  … homecare 連携（必須）
 *   DATABASE_URL                              … 取り込み先 DB（必須）
 *   HOMECARE_SYNC_DAYS      … 今日から何日ぶん取り込むか（既定 1 = 今日のみ）
 *   HOMECARE_SYNC_DRY_RUN   … 'false' のときだけ実書き込み（**既定 true=安全**）
 *
 * 安全策: 既定 dry-run。既存シートがある日は上書きせず skip（materialize 済み/編集済み保護）。
 *   まず HOMECARE_SYNC_DRY_RUN 未設定（=dry-run）で写像を確認してから false にすること。
 */

import { syncHomecareRouteForDate } from "../integrations/homecareSync";
import { HomecareApiError } from "../integrations/homecareClient";

/** JST の今日から offset 日後の YYYY-MM-DD を返す（サーバー TZ 非依存）。 */
function jstDateStr(offsetDays: number): string {
  const nowJst = new Date(Date.now() + 9 * 60 * 60 * 1000 + offsetDays * 24 * 60 * 60 * 1000);
  const y = nowJst.getUTCFullYear();
  const m = String(nowJst.getUTCMonth() + 1).padStart(2, "0");
  const d = String(nowJst.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

async function main(): Promise<void> {
  const days = Math.max(1, Number(process.env.HOMECARE_SYNC_DAYS ?? "1") || 1);
  const dryRun = process.env.HOMECARE_SYNC_DRY_RUN !== "false"; // 既定 true

  console.log(
    `[sync-homecare] start days=${days} dryRun=${dryRun} (${jstDateStr(0)}〜${jstDateStr(days - 1)} JST)`,
  );

  let ok = 0;
  let failed = 0;
  for (let i = 0; i < days; i++) {
    const date = jstDateStr(i);
    try {
      const r = await syncHomecareRouteForDate(date, { dryRun });
      if (r.kind === "dryRun") {
        console.log(`[sync-homecare] ${date} dryRun rows=${r.plan.rowCount} cells=${r.plan.cellCount}`);
      } else if (r.kind === "exists") {
        console.log(`[sync-homecare] ${date} skip（既存シート #${r.routeSheetId}）`);
      } else {
        console.log(
          `[sync-homecare] ${date} imported sheet=#${r.routeSheetId} rows=${r.rowCount} cells=${r.cellCount}`,
        );
      }
      ok++;
    } catch (err) {
      failed++;
      const detail =
        err instanceof HomecareApiError
          ? `${err.code ?? "homecare_error"} (${err.status ?? "-"}) ${err.message}`
          : err instanceof Error
            ? err.message
            : "unknown";
      console.error(`[sync-homecare] ${date} FAILED: ${detail}`);
    }
  }

  console.log(`[sync-homecare] done ok=${ok} failed=${failed}`);
  // 1 日でも失敗したら非ゼロ終了（Scheduled Deployment の失敗検知用）
  if (failed > 0) process.exitCode = 1;
}

void main();
