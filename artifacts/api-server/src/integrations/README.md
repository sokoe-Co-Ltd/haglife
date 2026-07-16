# homecare 連携（ルート表の取り込み）

homecare-route-app（訪問介護ルート表アプリ）が公開する読み取り専用 API から、その日の
ルート表を取得して Home-Navi の `route_sheet` に取り込むためのサーバー間連携。

方向: **homecare が提供 → Home-Navi が消費**（homecare は外部 API）。

- `homecareClient.ts` — homecare `GET /api/routes` の型付きクライアント（Bearer 認証）
- `homecareRouteMapper.ts` — homecare レスポンス → route_sheet 取り込みプランへの純粋写像
- `../routes/homecareIntegration.ts` — Express ルート（プレビュー＋dry-run 同期）
- 契約書（homecare 側）: homecare リポの `docs/api/openapi.yaml`

## 環境変数（Replit Secrets に設定）

| 変数 | 例 | 説明 |
| --- | --- | --- |
| `HOMECARE_API_BASE_URL` | `https://xxxx.vercel.app` | homecare 本番 URL（末尾スラッシュ無し） |
| `HOMECARE_API_KEY` | `hrk_...` | homecare 管理画面で発行した API キー（スコープ routes:read） |

> キーは homecare 管理画面「設定 → API キー（連携）」で発行し、発行時に一度だけ表示される
> `hrk_...` を Replit Secrets に登録する。フロントには出さない（サーバー側だけで使う）。

## エンドポイント

api-server（port 8080）。`/api` プレフィックス配下。

### GET `/api/integrations/homecare/routes?date=YYYY-MM-DD`

homecare の生レスポンスをそのまま返す（疎通・内容確認用）。

```bash
curl "http://localhost:8080/api/integrations/homecare/routes?date=2026-07-16"
```

### POST `/api/integrations/homecare/sync`

body: `{ "date": "YYYY-MM-DD", "dryRun": true }`

- `dryRun: true`（既定）: DB に書かず、写像プラン（作成される rows/cells）を返す。**まずこれで確認**。
- `dryRun: false`: その日の `route_sheets` が **無い場合のみ** sheet/rows/cells を作成する。
  既存シートがある日は上書きせず `409 sheet_exists`（materialize 済み/編集済みを保護）。
  再取り込みは既存シートを削除してから。

```bash
# プレビュー（安全）
curl -X POST http://localhost:8080/api/integrations/homecare/sync \
  -H "Content-Type: application/json" -d '{"date":"2026-07-16"}'

# 実書き込み（その日のシートが無い場合のみ作成）
curl -X POST http://localhost:8080/api/integrations/homecare/sync \
  -H "Content-Type: application/json" -d '{"date":"2026-07-16","dryRun":false}'
```

## 写像の設計判断（要確認）

`homecareRouteMapper.ts` のヘッダ参照。要点:

1. **staffId**: homecare は Firebase UID（文字列）でこちらの `staffId`（integer）と体系が違う →
   `route_sheet_rows.staffId` は null、`staffName`（表示名）だけで表す。突合はこちらの職員マスターと
   氏名（or 対応表）で。未割当訪問は「未割当」行にまとめる。
2. **status**: homecare の status 語彙とこちらの語彙の対応が未確定 → **全セル `planned`（計画取り込み）**
   とし、元の homecare status と visit.id を `cell.notes` に `homecare:{id} status:{s}` で残す
   （トレース＆再取り込みの冪等キー）。実態列（actualStaffId 等）は触らない。
3. **shiftType**: band（明/早/日/遅/夜）を JP 1 文字へ。複数 band 混在は最頻を採用、band 無しは「日」。
4. **serviceLabel**: serviceName 優先、無ければ serviceBillingCode。

## 未確認事項（Home-Navi 側で決めたい）

- **status のマッピング**: homecare の done/cancelled/not_performed 等をこちらのどの status に写すか
  （現状は全て planned で取り込み、原状態は notes に保存）。
- **staff の突合**: staffName でこちらの `staff` に紐づけて `staffId`/`actualStaffId` を埋めるか。
- **shiftType の語彙**: JP 1 文字（明/早/日/遅/夜）でよいか、こちらの `shift_types` に合わせるか。
- **再取り込み時の扱い**: 既存シートの上書き（materialize 済みの計画スナップショットを差し替えるか）。

## 検証（Replit 実環境で）

このコードは homecare の API キー・こちらの `DATABASE_URL` が要るため、Replit 実環境で確認する:

```bash
pnpm run typecheck                       # 型チェック（全パッケージ）
pnpm --filter @workspace/api-server run dev   # api-server 起動（port 8080）
# 上の curl でプレビュー → 問題なければ dryRun:false
```
