# 訪問介護スケジュール強化 — Replit Agent 向け実装指示書

> このドキュメントは、既存の Replit プロジェクト (React 19 + Vite + Express 5 + Drizzle + Postgres + OpenAPI/Orval 構成) に対する大規模機能追加の実装指示書です。Step A から Step E までを **順番通り** に実装してください。各 Step の完了確認チェックリストを通過してから次に進むこと。

---

## 0. 必読: 大原則

実装中、以下を**絶対に守ってください**:

1. **既存データを破壊しない**: 既存テーブルへの列追加は全て **nullable** で行う。既存の text 列 (`residentName`, `staffName`, `serviceLabel`) は削除せず残す
2. **段階移行**: テキスト列とFK列を併存させ、フロントは「FKがあれば優先、なければテキストフォールバック」のロジックで両対応
3. **`pnpm db:push` 前に必ず DB バックアップ**: `pg_dump $DATABASE_URL > backup_YYYYMMDD.sql` を必ず実行
4. **SQL View は push で管理不可**: ビューは `psql $DATABASE_URL -f <file.sql>` で個別に流す
5. **OpenAPI 更新後は必ず codegen**: `pnpm --filter @workspace/api-spec run codegen` を忘れない。型エラーが出たら最初に疑う
6. **Orval 生成物は手動編集禁止**: `lib/api-client-react/` 配下のファイルは上書きされる
7. **各 Step 完了時に typecheck**: `pnpm typecheck` がエラー0であることを確認してから次へ

---

## 1. 全体ロードマップ

```
Step A: スキーマ正規化 + service_types マスタ        [このドキュメント]
Step B: 競合検出 (visit_conflicts ビュー)            [このドキュメント]
Step C: シフト管理 (shift_types + shifts)            [このドキュメント]
Step D: 利用者サービス契約 (resident_services)        [このドキュメント]
Step E: テンプレート機能 (route_sheet_templates)     [このドキュメント]
─────────────────────────────────────────────
Step F: 力量警告 (staff.qualifications)              [次フェーズ]
Step G: 提供記録・請求連動                            [次フェーズ]
Step H: 自動割当 (制約付き最適化)                     [次フェーズ]
```

依存関係:
- Step B は Step A 完了が前提
- Step D は Step A 完了が前提
- Step E は Step C と Step D 完了が前提
- Step C と Step D は独立 (並行可能だが、順序通り推奨)

---

## 2. 既存システム前提 (Replit Agent 向け概要)

### スタック
- フロント: React 19 + Vite 7 + TypeScript + Tailwind v4 + shadcn/ui + Wouter + TanStack Query + react-hook-form + Zod
- バック: Express 5 + Node 24 + TypeScript
- DB: PostgreSQL + Drizzle ORM (push モード運用)
- API: OpenAPI 3.1 + Orval (フック自動生成)
- パッケージ管理: pnpm workspaces

### ディレクトリ構造
```
workspace/
├── artifacts/
│   ├── api-server/          ← Express (port 8080, /api プレフィックス)
│   │   └── src/
│   │       ├── index.ts
│   │       └── routes/
│   └── home-navi/           ← React (port 22173)
│       └── src/
│           ├── main.tsx
│           ├── AppRouter.tsx (Wouter)
│           ├── pages/
│           ├── components/
│           └── contexts/
└── lib/
    ├── api-spec/            ← openapi.yaml + Orval設定
    ├── api-zod/             ← 生成済み
    ├── api-client-react/    ← 生成済み
    └── db/
        └── src/schema/      ← Drizzle スキーマ
```

### 既存スキーマ (一部抜粋)
- `residents`: 利用者マスタ (id, lastName, firstName, moveInDate, movedOutAt, hospitalizedAt, ...)
- `staff`: 職員マスタ (id, lastName, firstName, role, ...)
- `route_sheets`: 日付別ルートシート (id, date, headerNote, ...)
- `route_sheet_rows`: スタッフ行 (id, routeSheetId, staffName text, shiftType, sortOrder)
- `route_sheet_cells`: 訪問コマ (id, routeSheetRowId, startTime, endTime, isBreak, residentName text, serviceLabel, notes)
- 他: handover_notes, vitals, meals, weights, eliminations, day_services, bath_reports, insurances

### 既存の `/route-sheet` ページ
画像で見せた Excel と同じ構造のガント風スケジューラー。15分グリッド・DnD実装済み。スタッフ名と利用者名は現状フリーテキスト。

---

# Step A: スキーマ正規化 + service_types マスタ

## 目的
利用者・スタッフ・サービス種別を全てFK参照に正規化する。テキスト列は移行期間中保持。

## A1. service_types テーブル新設

**新規ファイル: `lib/db/src/schema/service-types.ts`**

```typescript
import { pgTable, uuid, text, integer, boolean, timestamp } from 'drizzle-orm/pg-core';

export const serviceTypes = pgTable('service_types', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),                    // "身体介護30分"
  shortLabel: text('short_label').notNull(),       // "身１"
  category: text('category').notNull(),            // body/life/bathing/toileting/...
  durationMinutes: integer('duration_minutes').notNull(),
  unitPrice: integer('unit_price'),
  color: text('color'),                             // "#185FA5"
  sortOrder: integer('sort_order').default(0).notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export type ServiceType = typeof serviceTypes.$inferSelect;
export type NewServiceType = typeof serviceTypes.$inferInsert;

export const SERVICE_CATEGORIES = [
  'body', 'life', 'bathing', 'toileting', 'accompaniment', 'meal', 'cleaning', 'other',
] as const;
export type ServiceCategory = (typeof SERVICE_CATEGORIES)[number];
```

## A2. 既存テーブルへ FK 追加

**改修ファイル: `lib/db/src/schema/route-sheets.ts`**

```typescript
import { pgTable, uuid, text, boolean, integer, date, timestamp } from 'drizzle-orm/pg-core';
import { residents } from './residents';
import { staff } from './staff';
import { serviceTypes } from './service-types';

export const routeSheets = pgTable('route_sheets', {
  id: uuid('id').primaryKey().defaultRandom(),
  date: date('date').notNull().unique(),
  headerNote: text('header_note'),
  dayServiceNote: text('day_service_note'),
  specialNote: text('special_note'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const routeSheetRows = pgTable('route_sheet_rows', {
  id: uuid('id').primaryKey().defaultRandom(),
  routeSheetId: uuid('route_sheet_id').notNull().references(() => routeSheets.id, { onDelete: 'cascade' }),
  staffName: text('staff_name'),                  // 既存(残す)
  shiftType: text('shift_type'),                  // 既存(残す)
  sortOrder: integer('sort_order').default(0).notNull(),
  // 追加 (nullable)
  staffId: uuid('staff_id').references(() => staff.id, { onDelete: 'set null' }),
});

export const routeSheetCells = pgTable('route_sheet_cells', {
  id: uuid('id').primaryKey().defaultRandom(),
  routeSheetRowId: uuid('route_sheet_row_id').notNull().references(() => routeSheetRows.id, { onDelete: 'cascade' }),
  startTime: text('start_time').notNull(),
  endTime: text('end_time').notNull(),
  isBreak: boolean('is_break').default(false).notNull(),
  residentName: text('resident_name'),            // 既存(残す)
  serviceLabel: text('service_label'),            // 既存(残す)
  notes: text('notes'),
  // 追加 (nullable)
  residentId: uuid('resident_id').references(() => residents.id, { onDelete: 'set null' }),
  serviceTypeId: uuid('service_type_id').references(() => serviceTypes.id, { onDelete: 'set null' }),
});

export type RouteSheet = typeof routeSheets.$inferSelect;
export type RouteSheetRow = typeof routeSheetRows.$inferSelect;
export type RouteSheetCell = typeof routeSheetCells.$inferSelect;
```

## A3. schema バレル更新

**改修ファイル: `lib/db/src/schema/index.ts`**

```typescript
export * from './service-types';
// 他の export はそのまま
```

## A4. DB push 実行

```bash
# 必ずバックアップを取ってから
pg_dump "$DATABASE_URL" > backup_step_a_pre.sql

pnpm --filter @workspace/db run push
```

Drizzle が ALTER TABLE 提案を出すので Yes で進める。全FK列が nullable なので既存データ無影響。

## A5. service_types シード投入

**新規ファイル: `lib/db/src/seeds/service-types-seed.ts`**

```typescript
import { db } from '../client';
import { serviceTypes, type NewServiceType } from '../schema/service-types';

const seed: NewServiceType[] = [
  { name: '身体介護15分', shortLabel: '身15', category: 'body', durationMinutes: 15, color: '#185FA5', sortOrder: 10 },
  { name: '身体介護20分', shortLabel: '身０', category: 'body', durationMinutes: 20, color: '#185FA5', sortOrder: 20 },
  { name: '身体介護30分', shortLabel: '身１', category: 'body', durationMinutes: 30, color: '#185FA5', sortOrder: 30 },
  { name: '身体介護45分', shortLabel: '身2', category: 'body', durationMinutes: 45, color: '#185FA5', sortOrder: 40 },
  { name: '身体介護60分', shortLabel: '身3', category: 'body', durationMinutes: 60, color: '#185FA5', sortOrder: 50 },
  { name: '生活援助20分', shortLabel: '生０', category: 'life', durationMinutes: 20, color: '#0F6E56', sortOrder: 110 },
  { name: '生活援助30分', shortLabel: '生１', category: 'life', durationMinutes: 30, color: '#0F6E56', sortOrder: 120 },
  { name: '生活援助45分', shortLabel: '生2', category: 'life', durationMinutes: 45, color: '#0F6E56', sortOrder: 130 },
  { name: '生活援助60分', shortLabel: '生3', category: 'life', durationMinutes: 60, color: '#0F6E56', sortOrder: 140 },
  { name: '入浴介助45分', shortLabel: '入浴', category: 'bathing', durationMinutes: 45, color: '#534AB7', sortOrder: 200 },
  { name: '入浴介助60分', shortLabel: '入浴60', category: 'bathing', durationMinutes: 60, color: '#534AB7', sortOrder: 210 },
  { name: '排泄介助15分', shortLabel: '排泄', category: 'toileting', durationMinutes: 15, color: '#BA7517', sortOrder: 300 },
  { name: '排泄介助20分', shortLabel: '排泄20', category: 'toileting', durationMinutes: 20, color: '#BA7517', sortOrder: 310 },
  { name: '食事介助30分', shortLabel: '食介', category: 'meal', durationMinutes: 30, color: '#D85A30', sortOrder: 400 },
  { name: '食事介助60分', shortLabel: '食介60', category: 'meal', durationMinutes: 60, color: '#D85A30', sortOrder: 410 },
  { name: '掃除・洗濯30分', shortLabel: '掃・洗', category: 'cleaning', durationMinutes: 30, color: '#5DCAA5', sortOrder: 500 },
  { name: '通院介助・代行30分', shortLabel: '代行', category: 'accompaniment', durationMinutes: 30, color: '#D4537E', sortOrder: 600 },
];

async function run() {
  for (const s of seed) {
    await db.insert(serviceTypes).values(s).onConflictDoNothing();
  }
  console.log(`Seeded ${seed.length} service types`);
  process.exit(0);
}

run().catch((e) => { console.error(e); process.exit(1); });
```

```bash
pnpm --filter @workspace/db exec tsx src/seeds/service-types-seed.ts
```

## A6. OpenAPI 仕様更新

**改修ファイル: `lib/api-spec/openapi.yaml`**

`components.schemas` に追加:
```yaml
ServiceType:
  type: object
  required: [id, name, shortLabel, category, durationMinutes, isActive]
  properties:
    id: { type: string, format: uuid }
    name: { type: string }
    shortLabel: { type: string }
    category: { type: string, enum: [body, life, bathing, toileting, accompaniment, meal, cleaning, other] }
    durationMinutes: { type: integer, minimum: 15, maximum: 60 }
    unitPrice: { type: integer, nullable: true }
    color: { type: string, nullable: true }
    sortOrder: { type: integer }
    isActive: { type: boolean }
    createdAt: { type: string, format: date-time }
    updatedAt: { type: string, format: date-time }

ServiceTypeCreate:
  type: object
  required: [name, shortLabel, category, durationMinutes]
  properties:
    name: { type: string }
    shortLabel: { type: string }
    category: { type: string, enum: [body, life, bathing, toileting, accompaniment, meal, cleaning, other] }
    durationMinutes: { type: integer, minimum: 15, maximum: 60 }
    unitPrice: { type: integer, nullable: true }
    color: { type: string, nullable: true }
    sortOrder: { type: integer, default: 0 }
    isActive: { type: boolean, default: true }

ServiceTypeUpdate:
  type: object
  properties:
    name: { type: string }
    shortLabel: { type: string }
    category: { type: string, enum: [body, life, bathing, toileting, accompaniment, meal, cleaning, other] }
    durationMinutes: { type: integer, minimum: 15, maximum: 60 }
    unitPrice: { type: integer, nullable: true }
    color: { type: string, nullable: true }
    sortOrder: { type: integer }
    isActive: { type: boolean }
```

既存の `RouteSheetCell` / `RouteSheetRow` スキーマに以下を追加:
```yaml
RouteSheetCell:
  # 既存プロパティに追加
  properties:
    # ...
    residentId: { type: string, format: uuid, nullable: true }
    serviceTypeId: { type: string, format: uuid, nullable: true }

RouteSheetRow:
  properties:
    # ...
    staffId: { type: string, format: uuid, nullable: true }
```

`paths` に追加:
```yaml
/service-types:
  get:
    operationId: listServiceTypes
    parameters:
      - in: query
        name: isActive
        schema: { type: boolean }
    responses:
      '200':
        description: OK
        content:
          application/json:
            schema:
              type: array
              items: { $ref: '#/components/schemas/ServiceType' }
  post:
    operationId: createServiceType
    requestBody:
      required: true
      content:
        application/json:
          schema: { $ref: '#/components/schemas/ServiceTypeCreate' }
    responses:
      '201':
        description: Created
        content:
          application/json:
            schema: { $ref: '#/components/schemas/ServiceType' }

/service-types/{id}:
  get:
    operationId: getServiceType
    parameters:
      - in: path
        name: id
        required: true
        schema: { type: string, format: uuid }
    responses:
      '200': { description: OK, content: { application/json: { schema: { $ref: '#/components/schemas/ServiceType' } } } }
      '404': { description: Not Found }
  patch:
    operationId: updateServiceType
    parameters:
      - in: path
        name: id
        required: true
        schema: { type: string, format: uuid }
    requestBody:
      required: true
      content:
        application/json:
          schema: { $ref: '#/components/schemas/ServiceTypeUpdate' }
    responses:
      '200': { description: OK, content: { application/json: { schema: { $ref: '#/components/schemas/ServiceType' } } } }
  delete:
    operationId: deleteServiceType
    parameters:
      - in: path
        name: id
        required: true
        schema: { type: string, format: uuid }
    responses:
      '204': { description: No Content }
```

## A7. Orval 再生成

```bash
pnpm --filter @workspace/api-spec run codegen
```

## A8. Express: service_types ルート

**新規ファイル: `artifacts/api-server/src/routes/service-types.ts`**

```typescript
import { Router } from 'express';
import { eq, asc } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@workspace/db';
import { serviceTypes, SERVICE_CATEGORIES } from '@workspace/db/schema/service-types';

const router = Router();

const createSchema = z.object({
  name: z.string().min(1),
  shortLabel: z.string().min(1),
  category: z.enum(SERVICE_CATEGORIES),
  durationMinutes: z.number().int().min(15).max(60),
  unitPrice: z.number().int().nullable().optional(),
  color: z.string().nullable().optional(),
  sortOrder: z.number().int().default(0),
  isActive: z.boolean().default(true),
});

const updateSchema = createSchema.partial();

router.get('/', async (req, res) => {
  const isActive = req.query.isActive;
  const rows = await db
    .select()
    .from(serviceTypes)
    .where(isActive !== undefined ? eq(serviceTypes.isActive, isActive === 'true') : undefined)
    .orderBy(asc(serviceTypes.sortOrder), asc(serviceTypes.name));
  res.json(rows);
});

router.get('/:id', async (req, res) => {
  const row = await db.select().from(serviceTypes).where(eq(serviceTypes.id, req.params.id)).limit(1);
  if (row.length === 0) return res.status(404).json({ error: 'Not found' });
  res.json(row[0]);
});

router.post('/', async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.format() });
  const [created] = await db.insert(serviceTypes).values(parsed.data).returning();
  res.status(201).json(created);
});

router.patch('/:id', async (req, res) => {
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.format() });
  const [updated] = await db
    .update(serviceTypes)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(serviceTypes.id, req.params.id))
    .returning();
  if (!updated) return res.status(404).json({ error: 'Not found' });
  res.json(updated);
});

router.delete('/:id', async (req, res) => {
  const result = await db.delete(serviceTypes).where(eq(serviceTypes.id, req.params.id)).returning();
  if (result.length === 0) return res.status(404).json({ error: 'Not found' });
  res.status(204).send();
});

export default router;
```

## A9. Express: route-sheets ルート改修

**改修ファイル: `artifacts/api-server/src/routes/route-sheets.ts`**

既存の upsert ハンドラに `residentId`, `serviceTypeId`, `staffId` のサポートを追加:

```typescript
import { Router } from 'express';
import { eq, inArray } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@workspace/db';
import {
  routeSheets, routeSheetRows, routeSheetCells,
} from '@workspace/db/schema/route-sheets';

const router = Router();
const timeRe = /^[0-2][0-9]:[0-5][0-9]$/;

const cellSchema = z.object({
  id: z.string().uuid().optional(),
  startTime: z.string().regex(timeRe),
  endTime: z.string().regex(timeRe),
  isBreak: z.boolean().default(false),
  residentName: z.string().nullable().optional(),
  serviceLabel: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  residentId: z.string().uuid().nullable().optional(),       // 追加
  serviceTypeId: z.string().uuid().nullable().optional(),    // 追加
});

const rowSchema = z.object({
  id: z.string().uuid().optional(),
  staffName: z.string().nullable().optional(),
  shiftType: z.enum(['明', '早', '日', '遅', '夜']).nullable().optional(),
  sortOrder: z.number().int().default(0),
  staffId: z.string().uuid().nullable().optional(),          // 追加
  cells: z.array(cellSchema).default([]),
});

const upsertSchema = z.object({
  headerNote: z.string().nullable().optional(),
  dayServiceNote: z.string().nullable().optional(),
  specialNote: z.string().nullable().optional(),
  rows: z.array(rowSchema).default([]),
});

router.get('/', async (req, res) => {
  const date = String(req.query.date ?? '');
  if (!date) return res.status(400).json({ error: 'date is required' });

  const [sheet] = await db.select().from(routeSheets).where(eq(routeSheets.date, date)).limit(1);
  if (!sheet) {
    return res.json({ source: 'empty', routeSheet: null, rows: [], cells: [], conflicts: [] });
  }

  const rows = await db.select().from(routeSheetRows).where(eq(routeSheetRows.routeSheetId, sheet.id));
  const rowIds = rows.map((r) => r.id);
  const cells = rowIds.length
    ? await db.select().from(routeSheetCells).where(inArray(routeSheetCells.routeSheetRowId, rowIds))
    : [];

  res.json({
    source: 'instance',
    routeSheet: sheet,
    rows,
    cells,
    conflicts: [],   // Step B で実装
  });
});

router.put('/:date', async (req, res) => {
  const parsed = upsertSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.format() });
  const { date } = req.params;

  await db.transaction(async (tx) => {
    let [sheet] = await tx.select().from(routeSheets).where(eq(routeSheets.date, date)).limit(1);
    if (!sheet) {
      [sheet] = await tx.insert(routeSheets).values({
        date,
        headerNote: parsed.data.headerNote ?? null,
        dayServiceNote: parsed.data.dayServiceNote ?? null,
        specialNote: parsed.data.specialNote ?? null,
      }).returning();
    } else {
      [sheet] = await tx.update(routeSheets).set({
        headerNote: parsed.data.headerNote ?? null,
        dayServiceNote: parsed.data.dayServiceNote ?? null,
        specialNote: parsed.data.specialNote ?? null,
        updatedAt: new Date(),
      }).where(eq(routeSheets.id, sheet.id)).returning();
    }

    await tx.delete(routeSheetRows).where(eq(routeSheetRows.routeSheetId, sheet.id));

    for (const row of parsed.data.rows) {
      const [insertedRow] = await tx.insert(routeSheetRows).values({
        routeSheetId: sheet.id,
        staffName: row.staffName ?? null,
        shiftType: row.shiftType ?? null,
        sortOrder: row.sortOrder,
        staffId: row.staffId ?? null,
      }).returning();
      if (row.cells.length > 0) {
        await tx.insert(routeSheetCells).values(
          row.cells.map((c) => ({
            routeSheetRowId: insertedRow.id,
            startTime: c.startTime,
            endTime: c.endTime,
            isBreak: c.isBreak,
            residentName: c.residentName ?? null,
            serviceLabel: c.serviceLabel ?? null,
            notes: c.notes ?? null,
            residentId: c.residentId ?? null,
            serviceTypeId: c.serviceTypeId ?? null,
          }))
        );
      }
    }
  });

  res.json({ ok: true });
});

router.delete('/:date', async (req, res) => {
  await db.delete(routeSheets).where(eq(routeSheets.date, req.params.date));
  res.status(204).send();
});

export default router;
```

## A10. ルート登録

**改修ファイル: `artifacts/api-server/src/index.ts`**

```typescript
import serviceTypesRouter from './routes/service-types';
app.use('/api/service-types', serviceTypesRouter);
```

## A11. フロント: ServiceType マスタページ

**新規ファイル: `artifacts/home-navi/src/pages/service-types.tsx`**

(コード全文は [Step A 補遺] セクション参照、shadcn/ui の Dialog + Table + Form を使った標準的なCRUDページ)

shadcn 標準パターン:
- 一覧 Table (色プレビュー、編集・削除ボタン)
- 新規/編集 Dialog (Form + Zod resolver)
- カテゴリは Select、所要時間は Number Input (15-60, step 5)

実装テンプレ:
```tsx
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  useListServiceTypes, useCreateServiceType,
  useUpdateServiceType, useDeleteServiceType,
} from '@workspace/api-client-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

const CATEGORIES = [
  { value: 'body', label: '身体介護' },
  { value: 'life', label: '生活援助' },
  { value: 'bathing', label: '入浴介助' },
  { value: 'toileting', label: '排泄介助' },
  { value: 'accompaniment', label: '通院介助・代行' },
  { value: 'meal', label: '食事介助' },
  { value: 'cleaning', label: '掃除・洗濯' },
  { value: 'other', label: 'その他' },
] as const;

const formSchema = z.object({
  name: z.string().min(1),
  shortLabel: z.string().min(1).max(8),
  category: z.enum(['body', 'life', 'bathing', 'toileting', 'accompaniment', 'meal', 'cleaning', 'other']),
  durationMinutes: z.coerce.number().int().min(15).max(60),
  color: z.string().nullable().optional(),
  sortOrder: z.coerce.number().int().default(0),
  isActive: z.boolean().default(true),
});

export default function ServiceTypesPage() {
  // 標準的なCRUDロジック、Dialogで新規/編集、Tableで一覧表示
  // 詳細実装は Replit Agent が補完
}
```

## A12. フロント: 訪問カードフォーム改修

既存の訪問コマ入力フォームに、利用者選択・サービス種別選択を追加。「マスタ選択 or フリーテキスト」両対応:

```tsx
const { data: residents = [] } = useListResidents();
const { data: serviceTypes = [] } = useListServiceTypes({ isActive: true });

// 利用者選択
<Select
  value={form.watch('residentId') ?? ''}
  onValueChange={(v) => {
    const resident = residents.find((r) => r.id === v);
    form.setValue('residentId', v || null);
    if (resident) form.setValue('residentName', `${resident.lastName} ${resident.firstName}`);
  }}
>
  <SelectTrigger><SelectValue placeholder="利用者を選択 (任意)" /></SelectTrigger>
  <SelectContent>
    <SelectItem value="">— マスタを使わず手入力 —</SelectItem>
    {residents.map((r) => (
      <SelectItem key={r.id} value={r.id}>{r.lastName} {r.firstName}</SelectItem>
    ))}
  </SelectContent>
</Select>

{!form.watch('residentId') && (
  <Input {...form.register('residentName')} placeholder="利用者名 (フリーテキスト)" />
)}

// サービス種別選択 (選択時に終了時刻自動計算)
<Select
  value={form.watch('serviceTypeId') ?? ''}
  onValueChange={(v) => {
    const st = serviceTypes.find((s) => s.id === v);
    form.setValue('serviceTypeId', v || null);
    if (st) {
      form.setValue('serviceLabel', st.shortLabel);
      const start = form.getValues('startTime');
      if (start) form.setValue('endTime', addMinutes(start, st.durationMinutes));
    }
  }}
>
  {/* SelectContent */}
</Select>
```

ヘルパー:
```typescript
function addMinutes(hhmm: string, mins: number): string {
  const [h, m] = hhmm.split(':').map(Number);
  const total = h * 60 + m + mins;
  return `${String(Math.floor(total / 60) % 24).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}
```

## A13. AppRouter 更新

**改修ファイル: `artifacts/home-navi/src/AppRouter.tsx`**

```tsx
import ServiceTypesPage from './pages/service-types';

// <Switch> 内に追加
<Route path="/service-types" component={ServiceTypesPage} />
```

サイドバー or ヘッダーから `/service-types` へのリンクも追加。

## Step A 完了確認

- [ ] `pnpm typecheck` がエラー0
- [ ] `/service-types` でCRUDが全部動く (作成・編集・削除・一覧)
- [ ] `/route-sheet` で訪問カード追加時に「利用者選択」「サービス種別選択」が出る
- [ ] サービス種別を選ぶと終了時刻が自動計算される
- [ ] 既存の手入力 (residentName 直書き) でも保存できる
- [ ] DBを直接見て、新規保存時に resident_id / service_type_id / staff_id が入っている

---

# Step B: 競合検出

## 目的
同一スタッフの時間重複を自動検出してUIで警告表示する。

## B1. SQL View 作成

**新規ファイル: `lib/db/migrations/0001_visit_conflicts_view.sql`**

```sql
CREATE OR REPLACE VIEW visit_conflicts AS
WITH cells_with_staff AS (
  SELECT
    c.id              AS cell_id,
    c.route_sheet_row_id,
    r.route_sheet_id,
    r.staff_id,
    COALESCE(r.staff_id::text, 'name:' || COALESCE(r.staff_name, '')) AS staff_key,
    c.start_time::time AS start_t,
    c.end_time::time   AS end_t
  FROM route_sheet_cells c
  JOIN route_sheet_rows r ON c.route_sheet_row_id = r.id
  WHERE c.is_break = false
    AND c.start_time ~ '^[0-2][0-9]:[0-5][0-9]$'
    AND c.end_time   ~ '^[0-2][0-9]:[0-5][0-9]$'
)
SELECT
  a.cell_id        AS cell_a_id,
  b.cell_id        AS cell_b_id,
  a.route_sheet_id,
  a.staff_id,
  a.staff_key,
  a.start_t        AS a_start,
  a.end_t          AS a_end,
  b.start_t        AS b_start,
  b.end_t          AS b_end
FROM cells_with_staff a
JOIN cells_with_staff b
  ON a.staff_key       = b.staff_key
  AND a.route_sheet_id = b.route_sheet_id
  AND a.cell_id        < b.cell_id
WHERE (a.start_t, a.end_t) OVERLAPS (b.start_t, b.end_t);

CREATE INDEX IF NOT EXISTS idx_route_sheet_rows_staff_id ON route_sheet_rows(staff_id);
CREATE INDEX IF NOT EXISTS idx_route_sheet_rows_route_sheet_id ON route_sheet_rows(route_sheet_id);
```

> staff_id が NULL のレガシーデータでも staff_name でグルーピングするフォールバック付き。

## B2. View 適用

```bash
psql "$DATABASE_URL" -f lib/db/migrations/0001_visit_conflicts_view.sql

# 動作確認
psql "$DATABASE_URL" -c "SELECT * FROM visit_conflicts LIMIT 5;"
```

## B3. Drizzle View 型定義

**新規ファイル: `lib/db/src/schema/views.ts`**

```typescript
import { pgView, uuid, text, time } from 'drizzle-orm/pg-core';

export const visitConflicts = pgView('visit_conflicts', {
  cellAId: uuid('cell_a_id').notNull(),
  cellBId: uuid('cell_b_id').notNull(),
  routeSheetId: uuid('route_sheet_id').notNull(),
  staffId: uuid('staff_id'),
  staffKey: text('staff_key').notNull(),
  aStart: time('a_start').notNull(),
  aEnd: time('a_end').notNull(),
  bStart: time('b_start').notNull(),
  bEnd: time('b_end').notNull(),
}).existing();

export type VisitConflict = typeof visitConflicts.$inferSelect;
```

**改修: `lib/db/src/schema/index.ts`**
```typescript
export * from './views';
```

## B4. Express ハンドラ更新

**改修ファイル: `artifacts/api-server/src/routes/route-sheets.ts`**

A9で書いた GET ハンドラの `conflicts: []` を実データに:

```typescript
import { visitConflicts } from '@workspace/db/schema/views';

router.get('/', async (req, res) => {
  // ... (前半は同じ)

  const conflicts = await db
    .select()
    .from(visitConflicts)
    .where(eq(visitConflicts.routeSheetId, sheet.id));

  res.json({
    source: 'instance',
    routeSheet: sheet,
    rows,
    cells,
    conflicts: conflicts.map((c) => ({
      cellAId: c.cellAId,
      cellBId: c.cellBId,
      staffId: c.staffId,
      aStart: c.aStart,
      aEnd: c.aEnd,
      bStart: c.bStart,
      bEnd: c.bEnd,
    })),
  });
});
```

## B5. OpenAPI 更新

```yaml
VisitConflict:
  type: object
  required: [cellAId, cellBId, aStart, aEnd, bStart, bEnd]
  properties:
    cellAId: { type: string, format: uuid }
    cellBId: { type: string, format: uuid }
    staffId: { type: string, format: uuid, nullable: true }
    aStart: { type: string }
    aEnd: { type: string }
    bStart: { type: string }
    bEnd: { type: string }

RouteSheetResponse:
  type: object
  required: [source, rows, cells, conflicts]
  properties:
    source: { type: string, enum: [instance, empty, template] }
    routeSheet:
      $ref: '#/components/schemas/RouteSheet'
      nullable: true
    rows:
      type: array
      items: { $ref: '#/components/schemas/RouteSheetRow' }
    cells:
      type: array
      items: { $ref: '#/components/schemas/RouteSheetCell' }
    conflicts:
      type: array
      items: { $ref: '#/components/schemas/VisitConflict' }
```

`paths` に `/route-sheets` の正式登録 (既存は未登録の可能性):
```yaml
/route-sheets:
  get:
    operationId: getRouteSheet
    parameters:
      - in: query
        name: date
        required: true
        schema: { type: string, format: date }
    responses:
      '200':
        description: OK
        content:
          application/json:
            schema: { $ref: '#/components/schemas/RouteSheetResponse' }
```

## B6. Orval 再生成

```bash
pnpm --filter @workspace/api-spec run codegen
```

## B7. フロント: 競合バナー

**新規ファイル: `artifacts/home-navi/src/components/route-sheet/ConflictBanner.tsx`**

```tsx
import { AlertTriangle } from 'lucide-react';

interface Props {
  conflicts: Array<{ cellAId: string; cellBId: string; aStart: string; bStart: string }>;
  cellsById: Record<string, { residentName?: string | null; startTime: string }>;
  rowsByCellId: Record<string, { staffName?: string | null }>;
}

export function ConflictBanner({ conflicts, cellsById, rowsByCellId }: Props) {
  if (conflicts.length === 0) return null;

  return (
    <div className="bg-amber-50 border-l-4 border-amber-600 rounded-r p-3 mb-3">
      <div className="flex items-start gap-2">
        <AlertTriangle className="w-5 h-5 text-amber-700 mt-0.5" />
        <div className="flex-1">
          <p className="text-sm font-medium text-amber-900">競合 {conflicts.length} 件</p>
          <ul className="mt-1 space-y-1 text-xs text-amber-800">
            {conflicts.slice(0, 5).map((c) => {
              const a = cellsById[c.cellAId];
              const b = cellsById[c.cellBId];
              const staff = rowsByCellId[c.cellAId]?.staffName ?? '(未割当)';
              return (
                <li key={`${c.cellAId}-${c.cellBId}`}>
                  <strong>{staff}</strong>: {a?.residentName ?? '?'} ({c.aStart.slice(0,5)}) と{' '}
                  {b?.residentName ?? '?'} ({c.bStart.slice(0,5)}) が重複
                </li>
              );
            })}
            {conflicts.length > 5 && <li className="text-amber-700">…他 {conflicts.length - 5} 件</li>}
          </ul>
        </div>
      </div>
    </div>
  );
}
```

## B8. フロント: 競合セルに赤枠

既存の `/route-sheet` ガントセル描画箇所:

```tsx
const conflictCellIds = new Set<string>();
conflicts.forEach((c) => {
  conflictCellIds.add(c.cellAId);
  conflictCellIds.add(c.cellBId);
});

// セル描画時
<div className={cn(
  'absolute rounded px-1 py-0.5 text-xs cursor-pointer',
  conflictCellIds.has(cell.id) && 'ring-2 ring-red-600 ring-offset-1 z-10'
)}>
  {/* セル内容 */}
  {conflictCellIds.has(cell.id) && (
    <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-600 rounded-full" />
  )}
</div>
```

## Step B 完了確認

- [ ] `psql -c "SELECT * FROM visit_conflicts;"` がエラーなし
- [ ] 同一スタッフ行に時間重複セルを2つ作る → 上部に競合バナー表示
- [ ] 競合セル2つに赤い ring と右上の赤丸が出る
- [ ] 重複を解消すると競合バナーが消える
- [ ] `pnpm typecheck` がエラー0

---

# Step C: シフト管理 (簡易)

## 目的
スタッフのシフト割当をDB管理し、`/route-sheet` で日付を開いた時にその日のシフトから自動的にスタッフ行を生成できるようにする。

## 設計判断
- **シフト種別はマスタ化** (拡張可能): 月固定の 明/早/日/遅/夜 だけでなく、店舗追加時に種別を増やせる
- **slot_label で多重対応**: 同一日に「早A」「早B」など複数人が同シフト種別を担当するケースに対応
- **シフトの個別時刻調整可能**: マスタの標準時刻だけでなく、日付ごとに調整可

## C1. shift_types マスタテーブル

**新規ファイル: `lib/db/src/schema/shift-types.ts`**

```typescript
import { pgTable, uuid, text, integer, boolean, timestamp } from 'drizzle-orm/pg-core';

export const shiftTypes = pgTable('shift_types', {
  id: uuid('id').primaryKey().defaultRandom(),
  code: text('code').notNull().unique(),         // "明" "早" "日" "遅" "夜"
  name: text('name').notNull(),                  // "明け番" "早番" など
  defaultStartTime: text('default_start_time'),  // "07:00"
  defaultEndTime: text('default_end_time'),      // "16:00"
  sortOrder: integer('sort_order').default(0).notNull(),
  color: text('color'),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export type ShiftType = typeof shiftTypes.$inferSelect;
export type NewShiftType = typeof shiftTypes.$inferInsert;
```

## C2. shifts テーブル

**新規ファイル: `lib/db/src/schema/shifts.ts`**

```typescript
import { pgTable, uuid, text, date, timestamp, unique } from 'drizzle-orm/pg-core';
import { staff } from './staff';
import { shiftTypes } from './shift-types';

export const shifts = pgTable(
  'shifts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    staffId: uuid('staff_id').notNull().references(() => staff.id, { onDelete: 'cascade' }),
    date: date('date').notNull(),
    shiftTypeId: uuid('shift_type_id').notNull().references(() => shiftTypes.id),
    slotLabel: text('slot_label').default('').notNull(),  // "" or "A" or "B"
    startTime: text('start_time'),                          // 個別調整 (NULLなら shift_type のデフォルト)
    endTime: text('end_time'),
    notes: text('notes'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (t) => ({
    uniqShift: unique().on(t.date, t.shiftTypeId, t.slotLabel, t.staffId),
  })
);

export type Shift = typeof shifts.$inferSelect;
export type NewShift = typeof shifts.$inferInsert;
```

**新規 INDEX**: `lib/db/migrations/0002_shifts_indexes.sql`
```sql
CREATE INDEX IF NOT EXISTS idx_shifts_date ON shifts(date);
CREATE INDEX IF NOT EXISTS idx_shifts_staff_date ON shifts(staff_id, date);
```

## C3. schema バレル更新

```typescript
// lib/db/src/schema/index.ts
export * from './shift-types';
export * from './shifts';
```

## C4. DB push + シード

```bash
pg_dump "$DATABASE_URL" > backup_step_c_pre.sql
pnpm --filter @workspace/db run push
psql "$DATABASE_URL" -f lib/db/migrations/0002_shifts_indexes.sql
```

**シード: `lib/db/src/seeds/shift-types-seed.ts`**
```typescript
import { db } from '../client';
import { shiftTypes } from '../schema/shift-types';

const seed = [
  { code: '明', name: '明け番', defaultStartTime: '07:00', defaultEndTime: '09:00', sortOrder: 10, color: '#A23B72' },
  { code: '早', name: '早番',   defaultStartTime: '08:00', defaultEndTime: '17:00', sortOrder: 20, color: '#2E86AB' },
  { code: '日', name: '日勤',   defaultStartTime: '09:00', defaultEndTime: '18:00', sortOrder: 30, color: '#06A77D' },
  { code: '遅', name: '遅番',   defaultStartTime: '11:00', defaultEndTime: '20:00', sortOrder: 40, color: '#F18F01' },
  { code: '夜', name: '夜勤',   defaultStartTime: '17:00', defaultEndTime: '09:00', sortOrder: 50, color: '#3C3C3C' },
];

async function run() {
  for (const s of seed) {
    await db.insert(shiftTypes).values(s).onConflictDoNothing();
  }
  process.exit(0);
}
run();
```

```bash
pnpm --filter @workspace/db exec tsx src/seeds/shift-types-seed.ts
```

## C5. OpenAPI 更新

`components.schemas` に `ShiftType`, `ShiftTypeCreate`, `ShiftTypeUpdate`, `Shift`, `ShiftCreate`, `ShiftUpdate` を追加 (パターンは service_types と同じ)。

`paths` に `/shift-types` と `/shifts` のCRUDを追加。

特に重要なエンドポイント:
```yaml
/shifts:
  get:
    operationId: listShifts
    parameters:
      - in: query
        name: date
        schema: { type: string, format: date }
      - in: query
        name: from
        schema: { type: string, format: date }
      - in: query
        name: to
        schema: { type: string, format: date }
      - in: query
        name: staffId
        schema: { type: string, format: uuid }
    responses:
      '200':
        description: OK
        content:
          application/json:
            schema:
              type: array
              items: { $ref: '#/components/schemas/Shift' }

/shifts/bulk:
  post:
    operationId: bulkUpsertShifts
    requestBody:
      required: true
      content:
        application/json:
          schema:
            type: object
            properties:
              shifts:
                type: array
                items: { $ref: '#/components/schemas/ShiftCreate' }
    responses:
      '200': { description: OK }
```

## C6. Express ルート

**新規ファイル: `artifacts/api-server/src/routes/shift-types.ts`**
パターンは service-types.ts と同じCRUD。

**新規ファイル: `artifacts/api-server/src/routes/shifts.ts`**

```typescript
import { Router } from 'express';
import { and, eq, gte, lte, asc } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@workspace/db';
import { shifts } from '@workspace/db/schema/shifts';

const router = Router();

const upsertSchema = z.object({
  staffId: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  shiftTypeId: z.string().uuid(),
  slotLabel: z.string().default(''),
  startTime: z.string().nullable().optional(),
  endTime: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

router.get('/', async (req, res) => {
  const { date, from, to, staffId } = req.query;
  const conditions = [];
  if (date) conditions.push(eq(shifts.date, String(date)));
  if (from) conditions.push(gte(shifts.date, String(from)));
  if (to) conditions.push(lte(shifts.date, String(to)));
  if (staffId) conditions.push(eq(shifts.staffId, String(staffId)));

  const rows = await db
    .select()
    .from(shifts)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(asc(shifts.date), asc(shifts.shiftTypeId));
  res.json(rows);
});

router.post('/', async (req, res) => {
  const parsed = upsertSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.format() });
  const [created] = await db
    .insert(shifts)
    .values(parsed.data)
    .onConflictDoUpdate({
      target: [shifts.date, shifts.shiftTypeId, shifts.slotLabel, shifts.staffId],
      set: { ...parsed.data, updatedAt: new Date() },
    })
    .returning();
  res.status(201).json(created);
});

router.post('/bulk', async (req, res) => {
  const bulkSchema = z.object({ shifts: z.array(upsertSchema) });
  const parsed = bulkSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.format() });

  await db.transaction(async (tx) => {
    for (const s of parsed.data.shifts) {
      await tx.insert(shifts).values(s).onConflictDoUpdate({
        target: [shifts.date, shifts.shiftTypeId, shifts.slotLabel, shifts.staffId],
        set: { ...s, updatedAt: new Date() },
      });
    }
  });
  res.json({ ok: true });
});

router.delete('/:id', async (req, res) => {
  const result = await db.delete(shifts).where(eq(shifts.id, req.params.id)).returning();
  if (result.length === 0) return res.status(404).json({ error: 'Not found' });
  res.status(204).send();
});

export default router;
```

**改修: `artifacts/api-server/src/index.ts`**
```typescript
import shiftTypesRouter from './routes/shift-types';
import shiftsRouter from './routes/shifts';
app.use('/api/shift-types', shiftTypesRouter);
app.use('/api/shifts', shiftsRouter);
```

## C7. フロント: シフト管理ページ

**新規ファイル: `artifacts/home-navi/src/pages/shifts.tsx`**

仕様:
- 月選択 (デフォルト当月)
- 縦: スタッフ一覧、横: 日付 (月の日数分)
- 各セルに該当日のシフトを表示 (例: "明" "早A" など)
- セルクリック → シフト割当Dialog
- Dialog: shift_type 選択 + slot_label 入力 + 時刻オーバーライド

UI実装の骨格:
```tsx
import { useState } from 'react';
import { format, eachDayOfInterval, startOfMonth, endOfMonth } from 'date-fns';
import {
  useListStaff, useListShiftTypes, useListShifts,
  useCreateShift, useDeleteShift,
} from '@workspace/api-client-react';

export default function ShiftsPage() {
  const [month, setMonth] = useState(new Date());
  const days = eachDayOfInterval({ start: startOfMonth(month), end: endOfMonth(month) });

  const { data: staffList = [] } = useListStaff();
  const { data: shiftTypes = [] } = useListShiftTypes({ isActive: true });
  const { data: shiftsData = [], refetch } = useListShifts({
    from: format(startOfMonth(month), 'yyyy-MM-dd'),
    to: format(endOfMonth(month), 'yyyy-MM-dd'),
  });

  const shiftsByKey = new Map<string, typeof shiftsData[0]>();
  shiftsData.forEach((s) => {
    shiftsByKey.set(`${s.staffId}_${s.date}`, s);
  });

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-medium">シフト管理</h1>
        {/* 月切替 */}
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse">
          <thead>
            <tr>
              <th className="border p-2 sticky left-0 bg-white">スタッフ</th>
              {days.map((d) => (
                <th key={d.toISOString()} className="border p-2 text-xs">
                  {format(d, 'M/d')}<br />
                  <span className="text-gray-400">({format(d, 'E')})</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {staffList.map((s) => (
              <tr key={s.id}>
                <td className="border p-2 sticky left-0 bg-white font-medium">
                  {s.lastName} {s.firstName}
                </td>
                {days.map((d) => {
                  const key = `${s.id}_${format(d, 'yyyy-MM-dd')}`;
                  const shift = shiftsByKey.get(key);
                  return (
                    <td
                      key={key}
                      className="border p-1 text-center cursor-pointer hover:bg-blue-50"
                      onClick={() => {/* Dialog open */}}
                    >
                      {shift && (
                        <span style={{ /* color from shift_type */ }}>
                          {/* shift_type.code + (slot_label || '') */}
                        </span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* シフト割当Dialog */}
    </div>
  );
}
```

## C8. /route-sheet ページの拡張

日付選択時に、その日のシフトから自動的にスタッフ行を生成するロジックを追加:

**改修箇所** (既存 `/route-sheet` ページ):

```tsx
const { data: routeSheetData } = useGetRouteSheet({ date });
const { data: shiftsForDate = [] } = useListShifts({ date });

// 当日シートが存在しない (source === 'empty') の場合、
// その日のシフトからスタッフ行を初期生成する
useEffect(() => {
  if (routeSheetData?.source === 'empty' && shiftsForDate.length > 0) {
    // シフトから route_sheet_rows の初期データを構築
    const initialRows = shiftsForDate.map((shift, idx) => ({
      staffId: shift.staffId,
      shiftTypeId: shift.shiftTypeId,
      slotLabel: shift.slotLabel,
      sortOrder: idx,
      cells: [],
    }));
    // setLocalRowsState(initialRows);
  }
}, [routeSheetData?.source, shiftsForDate]);
```

> 「シフトからスタッフ行を生成」を起動する明示ボタン (例: 「シフトから生成」) を画面に追加するのが UX として安全。

## C9. AppRouter 更新

```tsx
import ShiftsPage from './pages/shifts';
<Route path="/shifts" component={ShiftsPage} />
```

シフト種別マスタも別ページ:
```tsx
import ShiftTypesPage from './pages/shift-types';
<Route path="/shift-types" component={ShiftTypesPage} />
```

## Step C 完了確認

- [ ] `/shift-types` でシフト種別CRUDが動く
- [ ] `/shifts` で月カレンダーが表示され、スタッフ×日付セルにシフトを割り当てられる
- [ ] 同一スタッフが同じ日にシフトの重複登録を試みると、unique制約でエラーになる
- [ ] `/route-sheet` で日付を開くと、その日のシフトに基づいたスタッフ行が表示できる (または「シフトから生成」ボタンで生成できる)
- [ ] `pnpm typecheck` がエラー0

---

# Step D: 利用者サービス契約 (resident_services)

## 目的
利用者ごとの定期サービス契約 (誰が・何曜日に・何分の・どのサービスを受けるか) を独立テーブルで管理する。退去・入院時に自動で停止される。

## 設計判断
- **resident_services**: 「山崎様は月・水・金 7:00 から身体介護20分」を表現
- **退去 (residents.moved_out_at)**: 全契約自動停止 (active ビューでフィルタ)
- **入院 (residents.hospitalized_at)**: 全契約自動停止 (active ビューでフィルタ)
- **契約終了**: terminated_at で個別終了
- **入退院の細粒度ロギング**: 必要になったら別テーブルで追加 (現段階では実装しない)

## D1. resident_services テーブル

**新規ファイル: `lib/db/src/schema/resident-services.ts`**

```typescript
import { pgTable, uuid, text, integer, date, timestamp, jsonb } from 'drizzle-orm/pg-core';
import { residents } from './residents';
import { serviceTypes } from './service-types';
import { shiftTypes } from './shift-types';

export const residentServices = pgTable('resident_services', {
  id: uuid('id').primaryKey().defaultRandom(),
  residentId: uuid('resident_id').notNull().references(() => residents.id, { onDelete: 'cascade' }),
  serviceTypeId: uuid('service_type_id').notNull().references(() => serviceTypes.id),
  defaultStartTime: text('default_start_time').notNull(),
  defaultDurationMinutes: integer('default_duration_minutes').notNull(),
  weekdays: jsonb('weekdays').notNull().default('[]'),    // [0,1,2,...,6] (0=日, 1=月)
  preferredShiftTypeId: uuid('preferred_shift_type_id').references(() => shiftTypes.id),
  notes: text('notes'),
  effectiveFrom: date('effective_from').notNull(),
  terminatedAt: date('terminated_at'),
  terminationReason: text('termination_reason'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export type ResidentService = typeof residentServices.$inferSelect;
export type NewResidentService = typeof residentServices.$inferInsert;
```

## D2. active_resident_services ビュー

**新規ファイル: `lib/db/migrations/0003_active_resident_services_view.sql`**

```sql
CREATE OR REPLACE VIEW active_resident_services AS
SELECT rs.*
FROM resident_services rs
JOIN residents r ON r.id = rs.resident_id
WHERE r.moved_out_at IS NULL
  AND r.hospitalized_at IS NULL
  AND rs.terminated_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_resident_services_resident
  ON resident_services(resident_id)
  WHERE terminated_at IS NULL;
```

**新規ファイル: `lib/db/src/schema/views.ts` に追記**

```typescript
import { pgView } from 'drizzle-orm/pg-core';

export const activeResidentServices = pgView('active_resident_services', {
  id: uuid('id').notNull(),
  residentId: uuid('resident_id').notNull(),
  serviceTypeId: uuid('service_type_id').notNull(),
  defaultStartTime: text('default_start_time').notNull(),
  defaultDurationMinutes: integer('default_duration_minutes').notNull(),
  weekdays: jsonb('weekdays').notNull(),
  preferredShiftTypeId: uuid('preferred_shift_type_id'),
  notes: text('notes'),
  effectiveFrom: date('effective_from').notNull(),
  terminatedAt: date('terminated_at'),
  terminationReason: text('termination_reason'),
  createdAt: timestamp('created_at').notNull(),
  updatedAt: timestamp('updated_at').notNull(),
}).existing();
```

## D3. DB push + view 適用

```bash
pg_dump "$DATABASE_URL" > backup_step_d_pre.sql
pnpm --filter @workspace/db run push
psql "$DATABASE_URL" -f lib/db/migrations/0003_active_resident_services_view.sql
```

## D4. OpenAPI 更新

`ResidentService`, `ResidentServiceCreate`, `ResidentServiceUpdate` スキーマと、以下のエンドポイントを追加:

```yaml
/resident-services:
  get:
    operationId: listResidentServices
    parameters:
      - in: query
        name: residentId
        schema: { type: string, format: uuid }
      - in: query
        name: activeOnly
        schema: { type: boolean }
    # ...
  post:
    operationId: createResidentService
    # ...

/resident-services/{id}:
  get: # ...
  patch: # ...
  delete: # ...

/residents/{id}/services:
  get:
    operationId: listServicesByResident
    # ...
```

## D5. Express ルート

**新規ファイル: `artifacts/api-server/src/routes/resident-services.ts`**

```typescript
import { Router } from 'express';
import { and, eq, isNull, asc } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@workspace/db';
import { residentServices } from '@workspace/db/schema/resident-services';
import { activeResidentServices } from '@workspace/db/schema/views';

const router = Router();
const timeRe = /^[0-2][0-9]:[0-5][0-9]$/;

const createSchema = z.object({
  residentId: z.string().uuid(),
  serviceTypeId: z.string().uuid(),
  defaultStartTime: z.string().regex(timeRe),
  defaultDurationMinutes: z.number().int().min(15).max(60),
  weekdays: z.array(z.number().int().min(0).max(6)),
  preferredShiftTypeId: z.string().uuid().nullable().optional(),
  notes: z.string().nullable().optional(),
  effectiveFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

const updateSchema = createSchema.partial().extend({
  terminatedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  terminationReason: z.string().nullable().optional(),
});

router.get('/', async (req, res) => {
  const { residentId, activeOnly } = req.query;
  const useActive = activeOnly === 'true';

  if (useActive) {
    const rows = await db.select().from(activeResidentServices);
    const filtered = residentId
      ? rows.filter((r) => r.residentId === String(residentId))
      : rows;
    return res.json(filtered);
  }

  const conditions = [];
  if (residentId) conditions.push(eq(residentServices.residentId, String(residentId)));

  const rows = await db
    .select()
    .from(residentServices)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(asc(residentServices.effectiveFrom));
  res.json(rows);
});

router.get('/:id', async (req, res) => {
  const [row] = await db.select().from(residentServices).where(eq(residentServices.id, req.params.id)).limit(1);
  if (!row) return res.status(404).json({ error: 'Not found' });
  res.json(row);
});

router.post('/', async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.format() });
  const [created] = await db.insert(residentServices).values(parsed.data).returning();
  res.status(201).json(created);
});

router.patch('/:id', async (req, res) => {
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.format() });
  const [updated] = await db
    .update(residentServices)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(residentServices.id, req.params.id))
    .returning();
  if (!updated) return res.status(404).json({ error: 'Not found' });
  res.json(updated);
});

router.delete('/:id', async (req, res) => {
  // ソフトデリート方式: terminatedAt をセット
  const [updated] = await db
    .update(residentServices)
    .set({ terminatedAt: new Date().toISOString().slice(0, 10), updatedAt: new Date() })
    .where(eq(residentServices.id, req.params.id))
    .returning();
  if (!updated) return res.status(404).json({ error: 'Not found' });
  res.status(204).send();
});

export default router;
```

**改修: `artifacts/api-server/src/index.ts`**
```typescript
import residentServicesRouter from './routes/resident-services';
app.use('/api/resident-services', residentServicesRouter);
```

## D6. residents ルート: 退去時の自動契約終了

**改修ファイル: `artifacts/api-server/src/routes/residents.ts`**

`PATCH /residents/:id` ハンドラで、`movedOutAt` がセットされた場合に該当の resident_services を全て終了する処理を追加:

```typescript
router.patch('/:id', async (req, res) => {
  // ... 既存の更新処理

  await db.transaction(async (tx) => {
    const [updated] = await tx.update(residents).set(parsed.data).where(eq(residents.id, req.params.id)).returning();

    // 退去日がセットされた場合
    if (parsed.data.movedOutAt && updated.movedOutAt) {
      await tx
        .update(residentServices)
        .set({
          terminatedAt: parsed.data.movedOutAt,
          terminationReason: parsed.data.movedOutReason ?? '退去',
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(residentServices.residentId, req.params.id),
            isNull(residentServices.terminatedAt)
          )
        );
    }

    return updated;
  });

  // res.json(updated)
});
```

> 入院 (`hospitalizedAt`) の場合は `active_resident_services` ビューが自動でフィルタするので、resident_services テーブル側の更新は不要。退院時 (hospitalizedAt = null) も自動的に active に戻る。

## D7. フロント: 利用者詳細ページに契約サービス追加

**改修ファイル: 既存の `artifacts/home-navi/src/pages/residents/[id].tsx`** (または相当箇所)

```tsx
import { useListServicesByResident, useCreateResidentService, useUpdateResidentService, useDeleteResidentService } from '@workspace/api-client-react';

const WEEKDAYS = [
  { value: 0, label: '日' },
  { value: 1, label: '月' },
  { value: 2, label: '火' },
  { value: 3, label: '水' },
  { value: 4, label: '木' },
  { value: 5, label: '金' },
  { value: 6, label: '土' },
];

function ResidentServicesSection({ residentId }: { residentId: string }) {
  const { data: services = [], refetch } = useListServicesByResident(residentId);

  return (
    <section className="mt-8">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-medium">契約サービス ({services.filter((s) => !s.terminatedAt).length}件)</h2>
        <Button onClick={openCreate}>+ 新規サービス追加</Button>
      </div>

      <div className="space-y-2">
        {services.filter((s) => !s.terminatedAt).map((s) => (
          <div key={s.id} className="border rounded-lg p-3 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-base">🟢</span>
                <span className="font-medium">{/* service_type name */}</span>
              </div>
              <div className="text-sm text-gray-600 mt-1">
                {(s.weekdays as number[]).map((w) => WEEKDAYS.find((wd) => wd.value === w)?.label).join('・')} {s.defaultStartTime}〜
              </div>
              {s.notes && <div className="text-xs text-gray-500 mt-1">{s.notes}</div>}
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={() => openEdit(s)}>編集</Button>
              <Button variant="ghost" size="sm" onClick={() => terminateService(s.id)}>契約終了</Button>
            </div>
          </div>
        ))}
      </div>

      {/* 終了済みサービス一覧 (折りたたみ表示) */}
      <details className="mt-4">
        <summary className="text-sm text-gray-500 cursor-pointer">過去のサービス契約 ({services.filter((s) => s.terminatedAt).length}件)</summary>
        {/* 同じ表示パターンで terminated_at 入りを表示 */}
      </details>

      {/* 追加/編集 Dialog */}
    </section>
  );
}
```

## D8. 退去フォームの確認ダイアログ

利用者編集フォーム (退去日をセットする UI) に確認ダイアログを追加:

```tsx
const handleMoveOut = async (data) => {
  const activeServices = await fetchActiveServicesForResident(residentId);
  if (activeServices.length > 0) {
    const confirmed = window.confirm(
      `この利用者には ${activeServices.length} 件の有効なサービス契約があります。退去日 (${data.movedOutAt}) で全て契約終了扱いになります。よろしいですか?`
    );
    if (!confirmed) return;
  }
  await updateResidentMut.mutateAsync({ id: residentId, data });
};
```

## D9. 既存データからの bootstrap 移行ツール

**新規スクリプト: `lib/db/src/scripts/bootstrap-resident-services.ts`**

```typescript
import { db } from '../client';
import { routeSheets, routeSheetCells, routeSheetRows } from '../schema/route-sheets';
import { residents } from '../schema/residents';
import { serviceTypes } from '../schema/service-types';
import { residentServices } from '../schema/resident-services';
import { eq, and, isNull, gte } from 'drizzle-orm';

/**
 * 過去N週間の route_sheet_cells を分析し、resident_services の候補を提案する
 * 出力: 標準出力にJSON。手動でレビュー後にインポート。
 */
async function run() {
  const lookbackWeeks = 8;
  const lookbackDate = new Date();
  lookbackDate.setDate(lookbackDate.getDate() - lookbackWeeks * 7);
  const lookbackStr = lookbackDate.toISOString().slice(0, 10);

  // 利用者ごと・曜日ごと・時刻 (±15分丸め) ・サービス種別ごとに集計
  const cells = await db
    .select({
      cell: routeSheetCells,
      sheet: routeSheets,
    })
    .from(routeSheetCells)
    .innerJoin(routeSheetRows, eq(routeSheetCells.routeSheetRowId, routeSheetRows.id))
    .innerJoin(routeSheets, eq(routeSheetRows.routeSheetId, routeSheets.id))
    .where(gte(routeSheets.date, lookbackStr));

  type Key = string; // residentId|weekday|hh|mm|serviceTypeId
  const aggregation = new Map<Key, { count: number; sample: any }>();
  const eligibleDays = new Map<string, Map<number, number>>(); // residentId -> weekday -> 日数

  // 利用者の契約期間内かどうかで分母計算
  const residentsAll = await db.select().from(residents);
  const residentsById = new Map(residentsAll.map((r) => [r.id, r]));

  for (const { cell, sheet } of cells) {
    if (!cell.residentId || !cell.serviceTypeId || cell.isBreak) continue;
    const r = residentsById.get(cell.residentId);
    if (!r) continue;
    if (r.movedOutAt && r.movedOutAt < sheet.date) continue;
    if (r.moveInDate && r.moveInDate > sheet.date) continue;

    const date = new Date(sheet.date);
    const weekday = date.getDay();
    const [hh, mm] = cell.startTime.split(':');
    const roundedMm = Math.floor(parseInt(mm) / 15) * 15;
    const key = `${cell.residentId}|${weekday}|${hh}|${String(roundedMm).padStart(2, '0')}|${cell.serviceTypeId}`;

    if (!aggregation.has(key)) {
      aggregation.set(key, { count: 0, sample: cell });
    }
    aggregation.get(key)!.count++;
  }

  // 分母 = 該当曜日の有効日数
  for (const r of residentsAll) {
    const startDate = new Date(r.moveInDate ?? lookbackStr);
    const endDate = new Date(r.movedOutAt ?? new Date().toISOString().slice(0, 10));
    const effStart = startDate > lookbackDate ? startDate : lookbackDate;
    const effEnd = endDate < new Date() ? endDate : new Date();

    const weekdayCounts = new Map<number, number>();
    for (let d = new Date(effStart); d <= effEnd; d.setDate(d.getDate() + 1)) {
      const w = d.getDay();
      weekdayCounts.set(w, (weekdayCounts.get(w) ?? 0) + 1);
    }
    eligibleDays.set(r.id, weekdayCounts);
  }

  // 結果分類
  const proposals = [];
  for (const [key, { count, sample }] of aggregation) {
    const [residentId, weekdayStr, hh, mm, serviceTypeId] = key.split('|');
    const weekday = parseInt(weekdayStr);
    const denominator = eligibleDays.get(residentId)?.get(weekday) ?? 0;
    if (denominator === 0) continue;
    const rate = count / denominator;

    let classification = 'low';
    if (denominator >= 3 && rate >= 0.8) classification = 'certain';
    else if (denominator >= 3 && rate >= 0.5) classification = 'likely';
    else if (denominator < 3) classification = 'insufficient_data';

    proposals.push({
      residentId,
      serviceTypeId,
      weekday,
      startTime: `${hh}:${mm}`,
      count,
      denominator,
      rate: rate.toFixed(2),
      classification,
    });
  }

  console.log(JSON.stringify(proposals, null, 2));
  process.exit(0);
}

run().catch((e) => { console.error(e); process.exit(1); });
```

```bash
pnpm --filter @workspace/db exec tsx src/scripts/bootstrap-resident-services.ts > proposals.json
```

> 出力された proposals.json を人間がレビューして、`classification === 'certain'` のものだけ実際に resident_services にINSERTするUIを別途作るか、CLIで対話的に進めるのが現実的。MVPとしては JSON出力までで十分。

## Step D 完了確認

- [ ] `/residents/:id` ページに「契約サービス」セクションが表示される
- [ ] 利用者ごとに resident_services のCRUDが動く
- [ ] 利用者の `movedOutAt` をセットすると、resident_services が自動で terminatedAt セットされる (確認ダイアログ付き)
- [ ] 利用者の `hospitalizedAt` をセットすると、active_resident_services ビューから除外される (DB直接確認)
- [ ] 退院 (`hospitalizedAt` = null) すると active に戻る
- [ ] bootstrap スクリプトが正常終了し、proposals.json が生成される
- [ ] `pnpm typecheck` がエラー0

---

# Step E: テンプレート機能

## 目的
曜日ごとの「ルートテンプレート」を管理し、当日シートの基準として使う。当日のシフトと組み合わせて動的に当日シートを合成する。「この日をテンプレ保存」機能で既存の当日シートからテンプレを生成できる。

## 設計判断
- **テンプレは曜日固定の7レコード**: 日/月/火/水/木/金/土。初期化時に7行投入、ユーザーが新規作成する概念は無し
- **テンプレ行は shift_type + slot_label**: スタッフ名は持たない (シフト連動で動的に紐付け)
- **テンプレセルは resident_service_id 参照**: 利用者の契約サービスを直接指す。利用者の契約が変わればテンプレも自動追従
- **当日シートとの関係は「読み取り時合成」**: テンプレは静的、当日シートはユーザー編集時に初めて DB に materialize される (前回設計のA案)

## E1. テンプレートテーブル

**新規ファイル: `lib/db/src/schema/route-sheet-templates.ts`**

```typescript
import { pgTable, uuid, text, integer, smallint, boolean, timestamp } from 'drizzle-orm/pg-core';
import { shiftTypes } from './shift-types';
import { residentServices } from './resident-services';

export const routeSheetTemplates = pgTable('route_sheet_templates', {
  id: uuid('id').primaryKey().defaultRandom(),
  weekday: smallint('weekday').notNull().unique(),       // 0-6
  notes: text('notes'),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const routeSheetTemplateRows = pgTable('route_sheet_template_rows', {
  id: uuid('id').primaryKey().defaultRandom(),
  templateId: uuid('template_id').notNull().references(() => routeSheetTemplates.id, { onDelete: 'cascade' }),
  shiftTypeId: uuid('shift_type_id').notNull().references(() => shiftTypes.id),
  slotLabel: text('slot_label').default('').notNull(),
  sortOrder: integer('sort_order').default(0).notNull(),
});

export const routeSheetTemplateCells = pgTable('route_sheet_template_cells', {
  id: uuid('id').primaryKey().defaultRandom(),
  templateRowId: uuid('template_row_id').notNull().references(() => routeSheetTemplateRows.id, { onDelete: 'cascade' }),
  residentServiceId: uuid('resident_service_id').references(() => residentServices.id, { onDelete: 'cascade' }),
  startTime: text('start_time').notNull(),    // resident_service の default_start_time のスナップショット or 上書き
  endTime: text('end_time').notNull(),
  isBreak: boolean('is_break').default(false).notNull(),
  notes: text('notes'),
});

export type RouteSheetTemplate = typeof routeSheetTemplates.$inferSelect;
export type RouteSheetTemplateRow = typeof routeSheetTemplateRows.$inferSelect;
export type RouteSheetTemplateCell = typeof routeSheetTemplateCells.$inferSelect;
```

## E2. route_sheets への追加列

**改修ファイル: `lib/db/src/schema/route-sheets.ts`**

```typescript
export const routeSheets = pgTable('route_sheets', {
  // 既存のフィールド
  // ...
  // 追加
  materializedFromTemplateId: uuid('materialized_from_template_id').references(() => routeSheetTemplates.id),
  materializedAt: timestamp('materialized_at'),
});
```

## E3. DB push + 7テンプレ初期化

```bash
pg_dump "$DATABASE_URL" > backup_step_e_pre.sql
pnpm --filter @workspace/db run push
```

**シード: `lib/db/src/seeds/route-sheet-templates-seed.ts`**
```typescript
import { db } from '../client';
import { routeSheetTemplates } from '../schema/route-sheet-templates';

const WEEKDAYS = [
  { weekday: 0, notes: '日曜' },
  { weekday: 1, notes: '月曜' },
  { weekday: 2, notes: '火曜' },
  { weekday: 3, notes: '水曜' },
  { weekday: 4, notes: '木曜' },
  { weekday: 5, notes: '金曜' },
  { weekday: 6, notes: '土曜' },
];

async function run() {
  for (const w of WEEKDAYS) {
    await db.insert(routeSheetTemplates).values(w).onConflictDoNothing();
  }
  process.exit(0);
}
run();
```

```bash
pnpm --filter @workspace/db exec tsx src/seeds/route-sheet-templates-seed.ts
```

## E4. OpenAPI 更新

`RouteSheetTemplate`, `RouteSheetTemplateWithRowsAndCells`, `RouteSheetTemplateRowCreate`, `RouteSheetTemplateCellCreate` スキーマを追加。

主要エンドポイント:
```yaml
/route-sheet-templates:
  get:
    operationId: listRouteSheetTemplates
    responses:
      '200':
        description: OK
        content:
          application/json:
            schema:
              type: array
              items: { $ref: '#/components/schemas/RouteSheetTemplate' }

/route-sheet-templates/{weekday}:
  get:
    operationId: getRouteSheetTemplate
    parameters:
      - in: path
        name: weekday
        required: true
        schema: { type: integer, minimum: 0, maximum: 6 }
    responses:
      '200':
        content:
          application/json:
            schema: { $ref: '#/components/schemas/RouteSheetTemplateWithRowsAndCells' }
  put:
    operationId: upsertRouteSheetTemplate
    parameters:
      - in: path
        name: weekday
        required: true
        schema: { type: integer }
    requestBody:
      required: true
      content:
        application/json:
          schema:
            type: object
            properties:
              notes: { type: string, nullable: true }
              rows:
                type: array
                items: { $ref: '#/components/schemas/RouteSheetTemplateRowUpsert' }

/route-sheets/{date}/from-template:
  post:
    operationId: materializeFromTemplate
    parameters:
      - in: path
        name: date
        required: true
        schema: { type: string, format: date }
    responses:
      '201':
        description: 作成された当日シート

/route-sheets/{date}/save-as-template:
  post:
    operationId: saveAsTemplate
    parameters:
      - in: path
        name: date
        required: true
        schema: { type: string, format: date }
    responses:
      '200':
        description: テンプレに保存完了
```

## E5. Express ルート: テンプレートCRUD

**新規ファイル: `artifacts/api-server/src/routes/route-sheet-templates.ts`**

```typescript
import { Router } from 'express';
import { eq, inArray, asc } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@workspace/db';
import {
  routeSheetTemplates, routeSheetTemplateRows, routeSheetTemplateCells,
} from '@workspace/db/schema/route-sheet-templates';

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
  slotLabel: z.string().default(''),
  sortOrder: z.number().int().default(0),
  cells: z.array(cellSchema).default([]),
});

const upsertSchema = z.object({
  notes: z.string().nullable().optional(),
  rows: z.array(rowSchema).default([]),
});

router.get('/', async (_req, res) => {
  const templates = await db.select().from(routeSheetTemplates).orderBy(asc(routeSheetTemplates.weekday));
  res.json(templates);
});

router.get('/:weekday', async (req, res) => {
  const weekday = parseInt(req.params.weekday);
  const [template] = await db.select().from(routeSheetTemplates).where(eq(routeSheetTemplates.weekday, weekday)).limit(1);
  if (!template) return res.status(404).json({ error: 'Not found' });

  const rows = await db.select().from(routeSheetTemplateRows).where(eq(routeSheetTemplateRows.templateId, template.id));
  const rowIds = rows.map((r) => r.id);
  const cells = rowIds.length
    ? await db.select().from(routeSheetTemplateCells).where(inArray(routeSheetTemplateCells.templateRowId, rowIds))
    : [];

  res.json({ template, rows, cells });
});

router.put('/:weekday', async (req, res) => {
  const weekday = parseInt(req.params.weekday);
  const parsed = upsertSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.format() });

  await db.transaction(async (tx) => {
    const [template] = await tx.select().from(routeSheetTemplates).where(eq(routeSheetTemplates.weekday, weekday)).limit(1);
    if (!template) throw new Error('Template not found');

    await tx.update(routeSheetTemplates).set({ notes: parsed.data.notes ?? null, updatedAt: new Date() }).where(eq(routeSheetTemplates.id, template.id));

    await tx.delete(routeSheetTemplateRows).where(eq(routeSheetTemplateRows.templateId, template.id));

    for (const row of parsed.data.rows) {
      const [insertedRow] = await tx.insert(routeSheetTemplateRows).values({
        templateId: template.id,
        shiftTypeId: row.shiftTypeId,
        slotLabel: row.slotLabel,
        sortOrder: row.sortOrder,
      }).returning();
      if (row.cells.length > 0) {
        await tx.insert(routeSheetTemplateCells).values(
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

export default router;
```

## E6. route-sheets ルート拡張: テンプレからの動的合成

**改修ファイル: `artifacts/api-server/src/routes/route-sheets.ts`**

```typescript
import {
  routeSheetTemplates, routeSheetTemplateRows, routeSheetTemplateCells,
} from '@workspace/db/schema/route-sheet-templates';
import { shifts } from '@workspace/db/schema/shifts';
import { residentServices } from '@workspace/db/schema/resident-services';
import { residents } from '@workspace/db/schema/residents';

router.get('/', async (req, res) => {
  const date = String(req.query.date ?? '');
  if (!date) return res.status(400).json({ error: 'date is required' });

  // 1. 当日インスタンスを探す
  const [sheet] = await db.select().from(routeSheets).where(eq(routeSheets.date, date)).limit(1);

  if (sheet) {
    // インスタンス存在 → そのまま返す (Step B 同様)
    const rows = await db.select().from(routeSheetRows).where(eq(routeSheetRows.routeSheetId, sheet.id));
    const rowIds = rows.map((r) => r.id);
    const cells = rowIds.length
      ? await db.select().from(routeSheetCells).where(inArray(routeSheetCells.routeSheetRowId, rowIds))
      : [];
    const conflicts = await db.select().from(visitConflicts).where(eq(visitConflicts.routeSheetId, sheet.id));
    return res.json({ source: 'instance', routeSheet: sheet, rows, cells, conflicts });
  }

  // 2. インスタンスなし → テンプレから合成
  const weekday = new Date(date).getDay();
  const [template] = await db.select().from(routeSheetTemplates).where(eq(routeSheetTemplates.weekday, weekday)).limit(1);

  if (!template) {
    return res.json({ source: 'empty', routeSheet: null, rows: [], cells: [], conflicts: [] });
  }

  // テンプレの rows/cells 取得
  const tplRows = await db.select().from(routeSheetTemplateRows).where(eq(routeSheetTemplateRows.templateId, template.id));
  const tplRowIds = tplRows.map((r) => r.id);
  const tplCells = tplRowIds.length
    ? await db.select().from(routeSheetTemplateCells).where(inArray(routeSheetTemplateCells.templateRowId, tplRowIds))
    : [];

  // 当日のシフト取得
  const shiftsToday = await db.select().from(shifts).where(eq(shifts.date, date));

  // active な resident_services を一括取得 (テンプレcellのリゾルブ用)
  const tplResidentServiceIds = tplCells.map((c) => c.residentServiceId).filter(Boolean) as string[];
  const activeServices = tplResidentServiceIds.length
    ? await db
        .select({
          rs: residentServices,
          r: residents,
        })
        .from(residentServices)
        .innerJoin(residents, eq(residentServices.residentId, residents.id))
        .where(inArray(residentServices.id, tplResidentServiceIds))
    : [];

  const activeMap = new Map<string, any>();
  activeServices.forEach(({ rs, r }) => {
    // 入院/退去/契約終了をチェック
    if (r.movedOutAt || r.hospitalizedAt || rs.terminatedAt) return;
    activeMap.set(rs.id, { rs, r });
  });

  // 合成: テンプレ行ごとに、その日のシフトでマッチするスタッフを引き当てる
  const synthesizedRows = tplRows.map((tplRow, idx) => {
    const matchingShift = shiftsToday.find(
      (s) => s.shiftTypeId === tplRow.shiftTypeId && s.slotLabel === tplRow.slotLabel
    );
    return {
      id: `tpl-${tplRow.id}`,                       // 仮ID (フロント側でmaterialize時に置換)
      routeSheetId: null,
      staffName: null,                              // フロントで staff_id から解決
      staffId: matchingShift?.staffId ?? null,
      shiftType: null,                              // クライアントで shift_type マスタから取得
      sortOrder: tplRow.sortOrder,
      _templateRowId: tplRow.id,                    // materialize用
      _shiftTypeId: tplRow.shiftTypeId,
      _slotLabel: tplRow.slotLabel,
    };
  });

  const synthesizedCells = tplCells
    .filter((c) => !c.residentServiceId || activeMap.has(c.residentServiceId))
    .map((tplCell) => {
      const linked = tplCell.residentServiceId ? activeMap.get(tplCell.residentServiceId) : null;
      return {
        id: `tpl-${tplCell.id}`,
        routeSheetRowId: `tpl-${tplCell.templateRowId}`,
        startTime: tplCell.startTime,
        endTime: tplCell.endTime,
        isBreak: tplCell.isBreak,
        residentId: linked?.rs.residentId ?? null,
        residentName: linked ? `${linked.r.lastName} ${linked.r.firstName}` : null,
        serviceTypeId: linked?.rs.serviceTypeId ?? null,
        serviceLabel: null,
        notes: tplCell.notes,
        _templateCellId: tplCell.id,
      };
    });

  res.json({
    source: 'template',
    routeSheet: null,
    template: { id: template.id, weekday: template.weekday },
    rows: synthesizedRows,
    cells: synthesizedCells,
    conflicts: [],   // テンプレ表示時の競合検出も TODO で追加可能
  });
});
```

## E7. Express: テンプレからの materialize エンドポイント

```typescript
router.post('/:date/from-template', async (req, res) => {
  const { date } = req.params;
  const weekday = new Date(date).getDay();

  // 既存インスタンスがあれば400
  const [existing] = await db.select().from(routeSheets).where(eq(routeSheets.date, date)).limit(1);
  if (existing) return res.status(400).json({ error: 'Sheet already exists for this date' });

  const [template] = await db.select().from(routeSheetTemplates).where(eq(routeSheetTemplates.weekday, weekday)).limit(1);
  if (!template) return res.status(404).json({ error: 'No template for this weekday' });

  const tplRows = await db.select().from(routeSheetTemplateRows).where(eq(routeSheetTemplateRows.templateId, template.id));
  const tplRowIds = tplRows.map((r) => r.id);
  const tplCells = tplRowIds.length
    ? await db.select().from(routeSheetTemplateCells).where(inArray(routeSheetTemplateCells.templateRowId, tplRowIds))
    : [];

  const shiftsToday = await db.select().from(shifts).where(eq(shifts.date, date));

  await db.transaction(async (tx) => {
    const [sheet] = await tx.insert(routeSheets).values({
      date,
      materializedFromTemplateId: template.id,
      materializedAt: new Date(),
    }).returning();

    const rowIdMap = new Map<string, string>();   // tplRow.id → 新route_sheet_row.id

    for (const tplRow of tplRows) {
      const matchingShift = shiftsToday.find(
        (s) => s.shiftTypeId === tplRow.shiftTypeId && s.slotLabel === tplRow.slotLabel
      );
      const [newRow] = await tx.insert(routeSheetRows).values({
        routeSheetId: sheet.id,
        staffId: matchingShift?.staffId ?? null,
        staffName: null,    // フロントで staff_id から名前解決
        shiftType: null,    // shift_type マスタから引く想定
        sortOrder: tplRow.sortOrder,
      }).returning();
      rowIdMap.set(tplRow.id, newRow.id);
    }

    // cells を resident_services から解決して挿入
    const tplResidentServiceIds = tplCells.map((c) => c.residentServiceId).filter(Boolean) as string[];
    const services = tplResidentServiceIds.length
      ? await tx
          .select({ rs: residentServices, r: residents })
          .from(residentServices)
          .innerJoin(residents, eq(residentServices.residentId, residents.id))
          .where(inArray(residentServices.id, tplResidentServiceIds))
      : [];
    const serviceMap = new Map(services.map(({ rs, r }) => [rs.id, { rs, r }]));

    for (const tplCell of tplCells) {
      const linked = tplCell.residentServiceId ? serviceMap.get(tplCell.residentServiceId) : null;
      if (tplCell.residentServiceId && (!linked || linked.r.movedOutAt || linked.r.hospitalizedAt || linked.rs.terminatedAt)) {
        continue; // 入院/退去/契約終了の利用者はスキップ
      }
      await tx.insert(routeSheetCells).values({
        routeSheetRowId: rowIdMap.get(tplCell.templateRowId)!,
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
```

## E8. Express: 「この日をテンプレ保存」

```typescript
router.post('/:date/save-as-template', async (req, res) => {
  const { date } = req.params;
  const weekday = new Date(date).getDay();

  const [sheet] = await db.select().from(routeSheets).where(eq(routeSheets.date, date)).limit(1);
  if (!sheet) return res.status(404).json({ error: 'No sheet for this date' });

  const rows = await db.select().from(routeSheetRows).where(eq(routeSheetRows.routeSheetId, sheet.id));
  const rowIds = rows.map((r) => r.id);
  const cells = rowIds.length
    ? await db.select().from(routeSheetCells).where(inArray(routeSheetCells.routeSheetRowId, rowIds))
    : [];

  const [template] = await db.select().from(routeSheetTemplates).where(eq(routeSheetTemplates.weekday, weekday)).limit(1);

  await db.transaction(async (tx) => {
    // 既存のテンプレ rows/cells を全削除
    await tx.delete(routeSheetTemplateRows).where(eq(routeSheetTemplateRows.templateId, template.id));

    // 各 row を shift_type 化して保存 (staff_id は捨てる)
    for (const row of rows) {
      // row.staffId からシフト情報を逆引き
      const matchingShift = await tx.select().from(shifts).where(
        and(eq(shifts.staffId, row.staffId!), eq(shifts.date, date))
      ).limit(1);
      if (matchingShift.length === 0) continue;  // シフトが無い行はスキップ

      const [newTplRow] = await tx.insert(routeSheetTemplateRows).values({
        templateId: template.id,
        shiftTypeId: matchingShift[0].shiftTypeId,
        slotLabel: matchingShift[0].slotLabel,
        sortOrder: row.sortOrder,
      }).returning();

      const rowCells = cells.filter((c) => c.routeSheetRowId === row.id);
      for (const cell of rowCells) {
        // cell.residentId + cell.serviceTypeId から resident_service を逆引き
        let residentServiceId: string | null = null;
        if (cell.residentId && cell.serviceTypeId) {
          const [rs] = await tx
            .select()
            .from(residentServices)
            .where(
              and(
                eq(residentServices.residentId, cell.residentId),
                eq(residentServices.serviceTypeId, cell.serviceTypeId),
                isNull(residentServices.terminatedAt)
              )
            )
            .limit(1);
          residentServiceId = rs?.id ?? null;
        }

        await tx.insert(routeSheetTemplateCells).values({
          templateRowId: newTplRow.id,
          residentServiceId,
          startTime: cell.startTime,
          endTime: cell.endTime,
          isBreak: cell.isBreak,
          notes: cell.notes,
        });
      }
    }

    await tx.update(routeSheetTemplates).set({ updatedAt: new Date() }).where(eq(routeSheetTemplates.id, template.id));
  });

  res.json({ ok: true });
});
```

## E9. Express: 「テンプレに戻す」

```typescript
router.delete('/:date', async (req, res) => {
  // 既存実装が delete のはずなので、それを利用
  await db.delete(routeSheets).where(eq(routeSheets.date, req.params.date));
  res.status(204).send();
});
```

> 削除すれば次回 GET 時にテンプレから合成されるので、特別なエンドポイントは不要。フロント側で「テンプレに戻す」ボタンが DELETE /api/route-sheets/:date を呼べばいい。

## E10. ルート登録

```typescript
// artifacts/api-server/src/index.ts
import routeSheetTemplatesRouter from './routes/route-sheet-templates';
app.use('/api/route-sheet-templates', routeSheetTemplatesRouter);
```

## E11. フロント: テンプレ編集モード

**改修ファイル: 既存の `/route-sheet` ページ**

URLパラメータでモード切替:
- `/route-sheet?date=2026-06-30` → 当日シート編集モード
- `/route-sheet?mode=template&weekday=2` → 火曜テンプレ編集モード

```tsx
const [searchParams] = useSearchParams();
const mode = searchParams.get('mode') ?? 'daily';
const weekday = searchParams.get('weekday');

const isDailyMode = mode === 'daily';
const isTemplateMode = mode === 'template';

const { data: dailyData } = useGetRouteSheet({ date }, { enabled: isDailyMode });
const { data: templateData } = useGetRouteSheetTemplate({ weekday }, { enabled: isTemplateMode });

const sourceData = isDailyMode ? dailyData : templateData;
```

画面上部の状態バナー:
```tsx
{sourceData?.source === 'template' && (
  <div className="bg-blue-50 border-l-4 border-blue-600 p-3 mb-3">
    📋 テンプレート表示中 ({weekdayLabel(weekday)}テンプレ) — 編集すると当日シートが作成されます
    <Button onClick={() => materializeMut.mutate({ date })} className="ml-3">
      この日を編集する
    </Button>
  </div>
)}

{sourceData?.source === 'instance' && (
  <div className="flex justify-end gap-2 mb-3">
    <Button variant="outline" onClick={() => saveAsTemplateMut.mutate({ date })}>
      この日を{weekdayLabel(weekday)}テンプレとして保存
    </Button>
    <Button variant="outline" onClick={() => resetMut.mutate({ date })}>
      テンプレに戻す
    </Button>
  </div>
)}
```

## E12. フロント: テンプレ一覧ページ

**新規ファイル: `artifacts/home-navi/src/pages/route-sheet-templates.tsx`**

```tsx
const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];

export default function RouteSheetTemplatesPage() {
  const { data: templates = [] } = useListRouteSheetTemplates();
  const [, setLocation] = useLocation();

  return (
    <div className="p-6">
      <h1 className="text-xl font-medium mb-6">曜日テンプレート</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {WEEKDAYS.map((label, idx) => {
          const tpl = templates.find((t) => t.weekday === idx);
          return (
            <div
              key={idx}
              className="border rounded-lg p-4 cursor-pointer hover:bg-gray-50"
              onClick={() => setLocation(`/route-sheet?mode=template&weekday=${idx}`)}
            >
              <div className="text-lg font-medium">{label}曜</div>
              {tpl?.notes && <div className="text-sm text-gray-600 mt-1">{tpl.notes}</div>}
              <div className="text-xs text-gray-400 mt-2">
                最終更新: {tpl?.updatedAt ? format(new Date(tpl.updatedAt), 'yyyy-MM-dd HH:mm') : '未編集'}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

## E13. AppRouter 更新

```tsx
import RouteSheetTemplatesPage from './pages/route-sheet-templates';
<Route path="/route-sheet-templates" component={RouteSheetTemplatesPage} />
```

サイドバーから `/route-sheet-templates` への導線追加。

## Step E 完了確認

- [ ] `/route-sheet-templates` で7曜日のカードが表示される
- [ ] カードクリック → テンプレ編集モードに入る
- [ ] テンプレ編集モードで shift_type 行追加・利用者サービス契約からの訪問コマ追加ができる
- [ ] テンプレ保存後、その曜日の日付を開くとテンプレが「表示中」状態で見える
- [ ] テンプレ表示中に「この日を編集する」ボタン → 当日インスタンス生成、編集モードに移行
- [ ] 当日シート上で「この日を◯曜テンプレとして保存」ボタン → テンプレが上書きされる
- [ ] 当日シート上で「テンプレに戻す」ボタン → インスタンス削除、次回開いた時にテンプレが再表示される
- [ ] 入院中の利用者のサービスがテンプレ表示時に自動で除外されている
- [ ] `pnpm typecheck` がエラー0

---

# 9. 実装上の総合注意事項

## 9.1 Drizzle push のクセ

- `pnpm db:push` は ALTER TABLE/CREATE TABLE は得意だが、CREATE VIEW は管理しない
- 新規列追加は nullable で安全。NOT NULL を後から付ける場合は別マイグレーション
- 削除系の提案は要注意 (data loss を確認するプロンプトが出る)

## 9.2 SQL View の手動管理

Step B と Step D で View を使うが、それぞれの `.sql` ファイルは `psql` で個別に流す。`pnpm db:push` だけでは作成されない。

```bash
psql "$DATABASE_URL" -f lib/db/migrations/0001_visit_conflicts_view.sql
psql "$DATABASE_URL" -f lib/db/migrations/0003_active_resident_services_view.sql
```

## 9.3 OpenAPI と Orval の同期

- openapi.yaml を変更したら**必ず** `pnpm --filter @workspace/api-spec run codegen`
- 生成物 (`lib/api-client-react/*`, `lib/api-zod/*`) は **絶対に手動編集しない**
- 型エラーが出始めたら、まず codegen 漏れを疑う

## 9.4 既存データ無破壊原則

- 既存のテキスト列 (`residentName`, `staffName`, `serviceLabel`) は**残す**
- 新規FK列は全て nullable
- フロントは「FKがあれば優先、なければテキストフォールバック」
- バックフィルが必要なら別途UIで対応 (一括変換ボタンなど)

## 9.5 既存 /route-sheet との互換性

`/route-sheet` ページは既に動いている。Step A〜E を段階的に統合する際、各 Step 完了時点で**ページが壊れていないこと**を確認:

- Step A 完了時: フォームに resident/service_type 選択が追加されるが、既存の手入力でも保存できる
- Step B 完了時: 競合バナーが追加される
- Step C 完了時: シフトから自動的にスタッフ行が生成できるオプションが追加される (任意)
- Step D 完了時: 訪問カード追加時に「契約サービスから選ぶ」オプションが追加される (任意)
- Step E 完了時: テンプレ表示モードと当日編集モードの2モードに

## 9.6 エラー対応のコツ

| 症状 | 最初に疑うこと |
|---|---|
| 型エラー多発 | OpenAPI 更新後の codegen 漏れ |
| `column does not exist` | drizzle push 未実行 or 失敗 |
| `relation visit_conflicts does not exist` | View のSQL流し忘れ |
| Orval生成物の差分 | 手動編集してしまった (git checkoutで戻す) |
| データが消えた | バックアップから復元、Drizzle pushの提案を雑に y した可能性 |

---

# 10. 全体動作確認シナリオ

Step E まで完了後の、End-to-End 動作確認シナリオ:

```
1. /service-types で「身体介護20分」「入浴介助45分」を登録
2. /shift-types で 5種類のシフト種別を確認 (シード済み)
3. /staff で「山中」「中西」「小山」を登録
4. /shifts で 2026/6/29(月) のシフトを登録:
   - 明: 山中
   - 早: 中西
   - 日: 小山
5. /residents で「山崎太郎」を登録 (moveInDate: 2025/4/1)
6. /residents/[山崎] の契約サービスに以下を追加:
   - 身体介護20分, 月・水・金, 7:00, 明枠
7. /route-sheet-templates で月曜カードを開く
8. テンプレ編集モードで「明」行を追加 → 山崎様の身体介護20分(7:00) を配置
9. 保存
10. /route-sheet?date=2026-06-29 を開く
    → source: 'template' で月曜テンプレが表示される
    → 明行に「山中」が紐付き、山崎様の訪問コマが配置されている
11. 「この日を編集する」ボタン → materialize される
12. ガント上で訪問コマを 7:30 にずらす
13. 別の訪問コマを 7:30 に追加 → 競合検出されて赤枠+バナー
14. 「テンプレに戻す」ボタン → インスタンス削除 → 再度テンプレ表示
15. /residents/[山崎] で hospitalizedAt をセット
16. /route-sheet?date=2026-06-29 を再度開く → 山崎様の訪問コマが消えている
17. hospitalizedAt をクリア → 再表示される
18. /residents/[山崎] で movedOutAt をセット
    → 確認ダイアログで「1件のサービス契約が終了します」が出る
    → 同意して保存
    → /route-sheet?date=2026-06-29 で山崎様の訪問が消える (テンプレからもフィルタされる)
```

このシナリオが全部通れば Step E まで完成。

---

# 11. 次フェーズの予告 (Step F以降)

Step E まで完了したら、以下のフェーズに進めます。実装ガイドはStep E実装後にユーザーと再議論して作成:

- **Step F: 力量警告**: staff.qualifications で「入浴介助可否」「医療行為可否」等を管理、サービス種別とのマッチで警告表示
- **Step G: 提供記録・請求連動**: 当日訪問の実施時刻を別途記録、介保コードマッピング、月次出力
- **Step H: 自動割当**: 制約条件 (シフト時間内、力量、移動時間) を考慮した自動割当アルゴリズム

---

以上で実装指示書終了。詰まったポイントはチャットに戻って個別質問してください。
