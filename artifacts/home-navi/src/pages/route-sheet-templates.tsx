import { useState } from "react";
import {
  useListRouteSheetTemplates, useGetRouteSheetTemplate, useUpsertRouteSheetTemplate,
  useListShiftTypes,
  getGetRouteSheetTemplateQueryKey, getListRouteSheetTemplatesQueryKey,
} from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, Plus, GripVertical, ChevronLeft } from "lucide-react";
import { format } from "date-fns";

const WEEKDAY_LABELS = ["日曜日", "月曜日", "火曜日", "水曜日", "木曜日", "金曜日", "土曜日"];
const WEEKDAY_SHORT = ["日", "月", "火", "水", "木", "金", "土"];

type CellDraft = {
  id?: string;
  startTime: string;
  endTime: string;
  isBreak: boolean;
  notes: string;
};

type RowDraft = {
  id?: string;
  shiftTypeId: string;
  slotLabel: string;
  sortOrder: number;
  cells: CellDraft[];
};

type Draft = {
  notes: string;
  rows: RowDraft[];
};

function emptyDraft(): Draft { return { notes: "", rows: [] }; }

function buildDraft(template: any, rows: any[], cells: any[]): Draft {
  return {
    notes: template.notes ?? "",
    rows: rows.map((r) => ({
      id: r.id,
      shiftTypeId: r.shiftTypeId,
      slotLabel: r.slotLabel,
      sortOrder: r.sortOrder,
      cells: cells
        .filter((c) => c.templateRowId === r.id)
        .map((c) => ({
          id: c.id,
          startTime: c.startTime,
          endTime: c.endTime,
          isBreak: c.isBreak,
          notes: c.notes ?? "",
        })),
    })),
  };
}

function WeekdayEditor({ weekday }: { weekday: number }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data: shiftTypes = [] } = useListShiftTypes();
  const { data: detail, isLoading } = useGetRouteSheetTemplate(weekday, { query: { enabled: true, queryKey: getGetRouteSheetTemplateQueryKey(weekday) } });

  const [draft, setDraft] = useState<Draft | null>(null);
  const [dirty, setDirty] = useState(false);

  const currentDraft: Draft = draft ?? (detail
    ? buildDraft((detail as any).template, (detail as any).rows ?? [], (detail as any).cells ?? [])
    : emptyDraft());

  const upsertMut = useUpsertRouteSheetTemplate({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getGetRouteSheetTemplateQueryKey(weekday) });
        qc.invalidateQueries({ queryKey: getListRouteSheetTemplatesQueryKey() });
        setDraft(null);
        setDirty(false);
        toast({ title: "保存しました" });
      },
    },
  });

  function update(fn: (d: Draft) => Draft) {
    setDraft(fn(currentDraft));
    setDirty(true);
  }

  function addRow() {
    const firstType = (shiftTypes as any[])[0];
    update((d) => ({
      ...d,
      rows: [...d.rows, {
        shiftTypeId: firstType?.id ?? "",
        slotLabel: `枠${d.rows.length + 1}`,
        sortOrder: d.rows.length,
        cells: [],
      }],
    }));
  }

  function removeRow(ri: number) {
    update((d) => ({ ...d, rows: d.rows.filter((_, i) => i !== ri) }));
  }

  function addCell(ri: number) {
    update((d) => ({
      ...d,
      rows: d.rows.map((r, i) => i !== ri ? r : {
        ...r,
        cells: [...r.cells, { startTime: "09:00", endTime: "09:30", isBreak: false, notes: "" }],
      }),
    }));
  }

  function removeCell(ri: number, ci: number) {
    update((d) => ({
      ...d,
      rows: d.rows.map((r, i) => i !== ri ? r : {
        ...r,
        cells: r.cells.filter((_, j) => j !== ci),
      }),
    }));
  }

  function setRowField<K extends keyof RowDraft>(ri: number, key: K, val: RowDraft[K]) {
    update((d) => ({
      ...d,
      rows: d.rows.map((r, i) => i !== ri ? r : { ...r, [key]: val }),
    }));
  }

  function setCellField<K extends keyof CellDraft>(ri: number, ci: number, key: K, val: CellDraft[K]) {
    update((d) => ({
      ...d,
      rows: d.rows.map((r, i) => i !== ri ? r : {
        ...r,
        cells: r.cells.map((c, j) => j !== ci ? c : { ...c, [key]: val }),
      }),
    }));
  }

  async function save() {
    await upsertMut.mutateAsync({ weekday, data: currentDraft });
  }

  if (isLoading) return <div className="py-12 text-center text-sm text-gray-400">読み込み中...</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-500">{WEEKDAY_LABELS[weekday]}のルート票テンプレートを編集</span>
        <Button size="sm" onClick={save} disabled={!dirty || upsertMut.isPending}>
          保存
        </Button>
      </div>

      {/* Rows */}
      <div className="space-y-3">
        {currentDraft.rows.length === 0 && (
          <div className="text-center py-8 text-sm text-gray-400 border-2 border-dashed rounded-xl">
            行を追加してください
          </div>
        )}
        {currentDraft.rows.map((row, ri) => {
          const st = (shiftTypes as any[]).find(t => t.id === row.shiftTypeId);
          return (
            <div key={ri} className="border border-gray-200 rounded-xl overflow-hidden">
              {/* Row header */}
              <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 border-b">
                <GripVertical className="h-4 w-4 text-gray-300" />
                <Select value={row.shiftTypeId} onValueChange={(v) => setRowField(ri, "shiftTypeId", v)}>
                  <SelectTrigger className="h-7 text-xs w-28">
                    <SelectValue>
                      {st ? (
                        <span className="px-1.5 py-0.5 rounded text-xs font-bold" style={{ background: (st.color ?? "#888") + "22", color: st.color ?? "#555" }}>
                          {st.code}
                        </span>
                      ) : "シフト"}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {(shiftTypes as any[]).map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        <span className="px-1 py-0.5 rounded text-xs font-bold mr-1.5" style={{ background: (t.color ?? "#888") + "22", color: t.color ?? "#555" }}>{t.code}</span>
                        {t.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  value={row.slotLabel}
                  onChange={(e) => setRowField(ri, "slotLabel", e.target.value)}
                  className="h-7 text-xs w-28"
                  placeholder="枠ラベル"
                />
                <Button variant="ghost" size="icon" className="h-7 w-7 ml-auto text-gray-400 hover:text-red-500" onClick={() => removeRow(ri)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>

              {/* Cells */}
              <div className="p-2 space-y-1.5">
                {row.cells.map((cell, ci) => (
                  <div key={ci} className="flex items-center gap-2 bg-white border border-gray-100 rounded-lg px-2 py-1.5">
                    <Input
                      value={cell.startTime}
                      onChange={(e) => setCellField(ri, ci, "startTime", e.target.value)}
                      className="h-7 text-xs w-20"
                      placeholder="09:00"
                    />
                    <span className="text-gray-400 text-xs">〜</span>
                    <Input
                      value={cell.endTime}
                      onChange={(e) => setCellField(ri, ci, "endTime", e.target.value)}
                      className="h-7 text-xs w-20"
                      placeholder="09:30"
                    />
                    <label className="flex items-center gap-1 text-xs text-gray-500 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={cell.isBreak}
                        onChange={(e) => setCellField(ri, ci, "isBreak", e.target.checked)}
                        className="rounded"
                      />
                      休憩
                    </label>
                    <Input
                      value={cell.notes}
                      onChange={(e) => setCellField(ri, ci, "notes", e.target.value)}
                      className="h-7 text-xs flex-1"
                      placeholder="メモ"
                    />
                    <Button variant="ghost" size="icon" className="h-6 w-6 text-gray-300 hover:text-red-500 shrink-0" onClick={() => removeCell(ri, ci)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full h-7 text-xs text-gray-400 hover:text-primary hover:bg-primary/5 border border-dashed"
                  onClick={() => addCell(ri)}
                >
                  <Plus className="h-3 w-3 mr-1" />セルを追加
                </Button>
              </div>
            </div>
          );
        })}

        <Button variant="outline" size="sm" className="w-full" onClick={addRow}>
          <Plus className="h-4 w-4 mr-1" />行を追加
        </Button>
      </div>
    </div>
  );
}

const WEEKDAY_COLOR_TEXT = ["text-red-600", "text-gray-800", "text-gray-800", "text-gray-800", "text-gray-800", "text-gray-800", "text-blue-600"];
const WEEKDAY_CARD_CLS = [
  "border-red-200 bg-red-50 hover:bg-red-100",
  "border-gray-200 bg-white hover:bg-gray-50",
  "border-gray-200 bg-white hover:bg-gray-50",
  "border-gray-200 bg-white hover:bg-gray-50",
  "border-gray-200 bg-white hover:bg-gray-50",
  "border-gray-200 bg-white hover:bg-gray-50",
  "border-blue-200 bg-blue-50 hover:bg-blue-100",
];

export default function RouteSheetTemplatesPage() {
  const { data: templates = [] } = useListRouteSheetTemplates();
  const [selectedWeekday, setSelectedWeekday] = useState<number | null>(null);

  return (
    <Layout>
      <div className="space-y-5 max-w-4xl">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-800">ルート票テンプレート</h1>
            <p className="text-xs text-gray-500 mt-0.5">曜日ごとの定型ルート票を設定します。当日のルート票生成に使用されます。</p>
          </div>
          {selectedWeekday !== null && (
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setSelectedWeekday(null)}>
              <ChevronLeft className="h-4 w-4" />一覧へ戻る
            </Button>
          )}
        </div>

        {selectedWeekday === null ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {WEEKDAY_SHORT.map((label, idx) => {
              const tpl = (templates as any[]).find((t) => t.weekday === idx);
              return (
                <button
                  key={idx}
                  className={`border rounded-xl p-4 text-left cursor-pointer transition-colors ${WEEKDAY_CARD_CLS[idx]}`}
                  onClick={() => setSelectedWeekday(idx)}
                >
                  <div className={`text-2xl font-bold ${WEEKDAY_COLOR_TEXT[idx]}`}>{label}曜</div>
                  {tpl?.notes && (
                    <div className="text-xs text-gray-600 mt-2 line-clamp-2">{tpl.notes}</div>
                  )}
                  <div className="text-[11px] text-gray-400 mt-2">
                    最終更新: {tpl?.updatedAt ? format(new Date(tpl.updatedAt), "MM/dd HH:mm") : "未編集"}
                  </div>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <span className={`text-xl font-bold ${WEEKDAY_COLOR_TEXT[selectedWeekday]}`}>
                {WEEKDAY_LABELS[selectedWeekday]}
              </span>
              <span className="text-sm text-gray-500">のテンプレートを編集</span>
            </div>
            <WeekdayEditor weekday={selectedWeekday} />
          </div>
        )}
      </div>
    </Layout>
  );
}
