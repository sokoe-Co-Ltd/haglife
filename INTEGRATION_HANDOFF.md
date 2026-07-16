# 引き継ぎ: homecare ルート表連携（PR #1）の取り込み・検証

外部の **homecare-route-app**（訪問介護ルート表アプリ）が「その日のルート表」を読み取り専用
API で公開している（`GET /api/routes`・Bearer 認証）。それを **Home-Navi の `route_sheet`**
に取り込む実装をこの PR で用意した。方向は **homecare 提供 → Home-Navi 消費**。

このファイルは Replit 側（エージェント/作業者）が PR だけを見て自己完結で進められるための手順書。
仕様の詳細は `artifacts/api-server/src/integrations/README.md` を参照。

- 追加場所: `artifacts/api-server/src/integrations/`（client / mapper / sync）、
  `src/routes/homecareIntegration.ts`（HTTP ルート）、`src/scripts/syncHomecareRoutes.ts`（定期実行）
- 契約: homecare リポの `docs/api/openapi.yaml`（本 PR の型はここから転記済み。追加の codegen は不要）

---

## 手順

### 1. ブランチを取り込む
PR #1 を `main` にマージ、または `feat/homecare-route-integration` を checkout。

### 2. 型チェックを通す（このコードは Replit 実環境で未検証）
```bash
pnpm install
pnpm run typecheck
```
> ⚠️ このコードは外部環境で作成され、Replit の DB・homecare キーが無い状態で書かれている。
> **型エラーが出たら直すこと。** 既存の `src/routes/routeSheets.ts` と同じ書き方
> （`@workspace/db` からの `db`/テーブル import、`db.insert(...).values(...).returning()`、
> `db.transaction`、Express5 の型）に合わせている。`@types/node` の global `fetch` を使用。

### 3. Secrets を設定（api-server）
| Secret | 値 |
| --- | --- |
| `HOMECARE_API_BASE_URL` | homecare の本番 URL（末尾スラッシュ無し。例 `https://xxxx.vercel.app`） |
| `HOMECARE_API_KEY` | homecare 管理画面で発行した API キー（`hrk_...`。別途共有される） |

`DATABASE_URL` は既存のものを使用。

### 4. dry-run で写像を確認（DB に書かない）
```bash
pnpm --filter @workspace/api-server run dev   # api-server 起動（port 8080）

# 疎通（homecare の生レスポンス）
curl "http://localhost:8080/api/integrations/homecare/routes?date=<YYYY-MM-DD>"

# 写像プレビュー（dryRun 既定 true）
curl -X POST http://localhost:8080/api/integrations/homecare/sync \
  -H "Content-Type: application/json" -d '{"date":"<YYYY-MM-DD>"}'
```

### 5. 結果を homecare 側へフィードバック
手順 4 の dry-run レスポンス（`plan` の rows/cells）を共有し、実データで写像が妥当か確認する。
特に次の 3 点（下記「未確認事項」）。

---

## 未確認事項（homecare 側と決めたい写像）

| 項目 | 現状の写像 | 決めたいこと |
| --- | --- | --- |
| **status** | 全セル `"planned"` で取り込み。原状態と visit.id は `cell.notes` に `homecare:{id} status:{s}` で保存 | homecare の `done`/`cancelled`/`not_performed` 等をこちらのどの status に写すか |
| **staff** | homecare は Firebase UID（文字列）で体系が違うため `staffId` = null、`staffName`（表示名）のみ。未割当は「未割当」行 | `staffName` でこちらの `staff` に突合して `staffId`/`actualStaffId` を埋めるか |
| **shiftType** | `band`（明/早/日/遅/夜）を JP 1 文字へ。複数混在は最頻、band 無しは「日」 | こちらの `shift_types` の語彙に合わせるか |
| **再取り込み** | 既存シートがある日は上書きせず skip（materialize 済み/編集済みを保護） | 再取り込みで上書きしたいか |

---

## 自動同期（検証が済んでから）

Replit の **Scheduled Deployment** に登録して自動化する:
```
コマンド : pnpm --filter @workspace/api-server run sync:homecare
Secrets  : HOMECARE_API_BASE_URL / HOMECARE_API_KEY / DATABASE_URL
           HOMECARE_SYNC_DAYS=3         # 今日+2日ぶん
           HOMECARE_SYNC_DRY_RUN=false  # ← 検証が済むまでは設定しない（既定 dry-run）
スケジュール: 1 日 1 回 など
```

> ⚠️ **必ず「① dry-run で写像確認 → ② `HOMECARE_SYNC_DRY_RUN=false` で自動化」の順で。**
> 写像（status/staff/shiftType）が未確定のまま自動で書き込まないこと。既存シートは skip で保護。

---

## まとめ（このタスクで Replit 側にお願いすること）
1. マージ（or checkout）
2. `pnpm run typecheck` を通す（型エラーは修正）
3. Secrets 設定（キーは別途共有）
4. **dry-run** の出力を homecare 側へ共有（写像の妥当性確認）
5. 写像確定後に実書き込み → 自動同期を有効化

homecare 側（API・写像仕様）は homecare のオーナーが担当。dry-run の出力・型エラーを共有すれば
写像を調整する。
