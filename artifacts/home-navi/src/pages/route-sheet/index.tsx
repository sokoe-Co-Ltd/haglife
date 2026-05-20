import { useState } from "react";
import { Layout } from "@/components/layout";
import { useAppDate } from "@/contexts/AppDateContext";
import { DayNav } from "@/components/date-nav";
import { format } from "date-fns";
import { ja } from "date-fns/locale";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import {
  useListDayServices,
  useToggleDayServicePrepared,
  getListDayServicesQueryKey,
} from "@workspace/api-client-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Plus, Trash2, Save, Printer, Pencil, Coffee, GripVertical,
  CheckCircle2, Circle, ExternalLink,
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────────
type SheetCell = {
  id?: number;
  startTime: string;
  endTime: string;
  isBreak: boolean;
  residentName?: string | null;
  serviceLabel?: string | null;
  notes?: string | null;
};
type SheetRow = {
  id?: number;
  staffName: string;
  shiftType: string;
  sortOrder: number;
  cells: SheetCell[];
};
type RouteSheetData = {
  id?: number;
  date: string;
  headerNote?: string | null;
  dayServiceNote?: string | null;
  specialNote?: string | null;
  rows: SheetRow[];
};

// ── Constants ──────────────────────────────────────────────────────────────────
const MIN_START = 60;   // 1:00
const MIN_END   = 1380; // 23:00
const TOTAL_MIN = MIN_END - MIN_START; // 1320

const HOURS = Array.from({ length: 23 }, (_, i) => i + 1); // 1–23
const SHIFT_TYPES = ["明", "早", "日", "遅", "夜", "公休", "有休"];
const SERVICE_PRESETS = ["身０", "身１", "身２", "身３", "生２", "生３"];
const SERVICE_DETAILS = ["入浴", "排泄", "食介", "服薬", "掃・洗・シ", "掃・洗", "代行"];

function timeToMin(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}
function minToTime(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}
function timeLeft(t: string): number {
  return (Math.max(MIN_START, Math.min(MIN_END, timeToMin(t))) - MIN_START) / TOTAL_MIN * 100;
}
function timePct(s: string, e: string): number {
  return Math.max(0, (timeToMin(e) - timeToMin(s)) / TOTAL_MIN * 100);
}

function cellColor(cell: SheetCell): string {
  if (cell.isBreak) return "bg-amber-100 border-amber-300 text-amber-800";
  const lbl = (cell.serviceLabel ?? "").toLowerCase();
  if (/^身[０-３0-3]/.test(lbl)) return "bg-blue-100 border-blue-300 text-blue-900";
  if (/^生[２-３2-3]/.test(lbl)) return "bg-green-100 border-green-300 text-green-900";
  if (lbl.includes("入浴")) return "bg-cyan-100 border-cyan-300 text-cyan-900";
  if (lbl.includes("排泄")) return "bg-orange-100 border-orange-300 text-orange-900";
  return "bg-gray-100 border-gray-300 text-gray-800";
}

// ── API ────────────────────────────────────────────────────────────────────────
async function fetchSheet(date: string): Promise<RouteSheetData | null> {
  const r = await fetch(`/api/route-sheets?date=${date}`);
  if (!r.ok) throw new Error("Failed to fetch");
  return r.json();
}
async function saveSheet(date: string, data: Omit<RouteSheetData, "id" | "date">): Promise<RouteSheetData> {
  const r = await fetch(`/api/route-sheets/${date}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!r.ok) throw new Error("Failed to save");
  return r.json();
}

// ── Empty defaults ─────────────────────────────────────────────────────────────
function emptySheet(date: string): RouteSheetData {
  return { date, headerNote: "", dayServiceNote: "", specialNote: "", rows: [] };
}
function emptyRow(sortOrder: number): SheetRow {
  return { staffName: "", shiftType: "日", sortOrder, cells: [] };
}
function emptyCell(): SheetCell {
  return { startTime: "09:00", endTime: "10:00", isBreak: false, residentName: "", serviceLabel: "" };
}

// ── Cell block ─────────────────────────────────────────────────────────────────
function CellBlock({
  cell, onClick,
}: { cell: SheetCell; onClick: () => void }) {
  const left = timeLeft(cell.startTime);
  const width = timePct(cell.startTime, cell.endTime);
  const colorCls = cellColor(cell);
  return (
    <button
      onClick={onClick}
      style={{ left: `${left}%`, width: `${Math.max(width, 1)}%` }}
      className={`absolute top-0.5 bottom-0.5 border rounded text-left overflow-hidden px-1 hover:opacity-80 transition-opacity cursor-pointer ${colorCls}`}
      title={cell.isBreak ? "休憩" : `${cell.residentName ?? ""} ${cell.serviceLabel ?? ""}`}
    >
      {cell.isBreak ? (
        <span className="text-[10px] font-bold flex items-center gap-0.5">
          <Coffee className="h-2.5 w-2.5 shrink-0" />休憩
        </span>
      ) : (
        <>
          <div className="text-[10px] font-semibold leading-tight truncate">{cell.residentName}</div>
          <div className="text-[9px] leading-tight truncate opacity-80">{cell.serviceLabel}</div>
        </>
      )}
    </button>
  );
}

// ── Timeline row ───────────────────────────────────────────────────────────────
function TimelineRow({
  row, rowIndex, onCellClick, onAddCell,
}: {
  row: SheetRow;
  rowIndex: number;
  onCellClick: (ri: number, ci: number) => void;
  onAddCell: (ri: number) => void;
}) {
  return (
    <div className="relative h-10" style={{ minWidth: 1760 }}>
      {/* Hour grid lines */}
      {HOURS.map((h) => (
        <div
          key={h}
          style={{ left: `${(h * 60 - MIN_START) / TOTAL_MIN * 100}%` }}
          className="absolute top-0 bottom-0 border-l border-gray-100 pointer-events-none"
        />
      ))}
      {/* Click area to add */}
      <div
        className="absolute inset-0"
        onClick={() => onAddCell(rowIndex)}
      />
      {/* Cells */}
      {row.cells.map((cell, ci) => (
        <CellBlock
          key={ci}
          cell={cell}
          onClick={(e?: any) => { e?.stopPropagation?.(); onCellClick(rowIndex, ci); }}
        />
      ))}
    </div>
  );
}

// ── Cell edit modal ────────────────────────────────────────────────────────────
interface CellModalState {
  rowIndex: number;
  cellIndex: number | null;
  cell: SheetCell;
}

function CellModal({
  state, onSave, onDelete, onClose,
}: {
  state: CellModalState;
  onSave: (ri: number, ci: number | null, cell: SheetCell) => void;
  onDelete: (ri: number, ci: number) => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState<SheetCell>(state.cell);
  const [detailInput, setDetailInput] = useState("");

  const set = (k: keyof SheetCell, v: any) => setForm((p) => ({ ...p, [k]: v }));
  const appendDetail = (d: string) => {
    const cur = (form.serviceLabel ?? "").trim();
    const next = cur ? `${cur}\n${d}` : d;
    set("serviceLabel", next);
  };

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{state.cellIndex !== null ? "訪問を編集" : "訪問を追加"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="flex gap-2 items-center">
            <label className="text-xs w-16 shrink-0">休憩</label>
            <Checkbox
              checked={form.isBreak}
              onCheckedChange={(v) => set("isBreak", !!v)}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">開始時間</label>
              <Input type="time" value={form.startTime} onChange={(e) => set("startTime", e.target.value)} className="h-8 text-sm" />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">終了時間</label>
              <Input type="time" value={form.endTime} onChange={(e) => set("endTime", e.target.value)} className="h-8 text-sm" />
            </div>
          </div>
          {!form.isBreak && (
            <>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">利用者名</label>
                <Input value={form.residentName ?? ""} onChange={(e) => set("residentName", e.target.value)} placeholder="山田 花子" className="h-8 text-sm" />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">サービス種別</label>
                <div className="flex flex-wrap gap-1 mb-1.5">
                  {SERVICE_PRESETS.map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => set("serviceLabel", p)}
                      className={`text-xs px-2 py-1 rounded border transition-colors ${
                        form.serviceLabel === p ? "bg-primary text-white border-primary" : "border-gray-200 hover:border-gray-300 text-gray-600"
                      }`}
                    >{p}</button>
                  ))}
                </div>
                <Input
                  value={form.serviceLabel ?? ""}
                  onChange={(e) => set("serviceLabel", e.target.value)}
                  placeholder="身０ など自由入力"
                  className="h-8 text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">サービス内容（詳細）</label>
                <div className="flex flex-wrap gap-1">
                  {SERVICE_DETAILS.map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => appendDetail(d)}
                      className="text-xs px-2 py-1 rounded border border-gray-200 hover:bg-gray-50 text-gray-600"
                    >{d}</button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">メモ</label>
                <Input value={form.notes ?? ""} onChange={(e) => set("notes", e.target.value)} placeholder="備考" className="h-8 text-sm" />
              </div>
            </>
          )}
        </div>
        <DialogFooter className="gap-2">
          {state.cellIndex !== null && (
            <Button variant="destructive" size="sm" onClick={() => { onDelete(state.rowIndex, state.cellIndex!); onClose(); }}>
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={onClose}>キャンセル</Button>
          <Button size="sm" onClick={() => { onSave(state.rowIndex, state.cellIndex, form); onClose(); }}>保存</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Staff row edit modal ───────────────────────────────────────────────────────
function StaffModal({
  row, rowIndex, onSave, onClose,
}: {
  row: SheetRow; rowIndex: number;
  onSave: (ri: number, row: Pick<SheetRow, "staffName" | "shiftType">) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(row.staffName);
  const [shift, setShift] = useState(row.shiftType);
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-xs">
        <DialogHeader><DialogTitle>スタッフ編集</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-gray-500 mb-1 block">氏名</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} className="h-8 text-sm" placeholder="山中" />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">勤務区分</label>
            <Select value={shift} onValueChange={setShift}>
              <SelectTrigger className="h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SHIFT_TYPES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose}>キャンセル</Button>
          <Button size="sm" onClick={() => { onSave(rowIndex, { staffName: name, shiftType: shift }); onClose(); }}>OK</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────
export default function RouteSheetPage() {
  const { appDate, setAppDate } = useAppDate();
  const dateStr = format(appDate, "yyyy-MM-dd");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: loaded, isLoading } = useQuery({
    queryKey: ["/api/route-sheets", dateStr],
    queryFn: () => fetchSheet(dateStr),
  });

  // ── Day services (linked) ─────────────────────────────────────────────────
  const { data: allDayServices } = useListDayServices();
  const togglePrepared = useToggleDayServicePrepared();
  const DOW_JP = ["日", "月", "火", "水", "木", "金", "土"] as const;
  const todayDow = DOW_JP[appDate.getDay()];
  const todayServices = (allDayServices ?? []).filter(
    (s) => Array.isArray(s.usageDays) && s.usageDays.includes(todayDow)
  );
  function handleTogglePrepared(id: number) {
    togglePrepared.mutate({ data: { id } }, {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: getListDayServicesQueryKey() }),
    });
  }

  const [localSheet, setLocalSheet] = useState<RouteSheetData | null>(null);
  const [dirty, setDirty] = useState(false);
  const [cellModal, setCellModal] = useState<CellModalState | null>(null);
  const [staffModal, setStaffModal] = useState<{ row: SheetRow; rowIndex: number } | null>(null);

  const sheet: RouteSheetData = localSheet ?? loaded ?? emptySheet(dateStr);

  function mark(updated: RouteSheetData) {
    setLocalSheet(updated);
    setDirty(true);
  }

  const saveMutation = useMutation({
    mutationFn: () => saveSheet(dateStr, {
      headerNote: sheet.headerNote,
      dayServiceNote: sheet.dayServiceNote,
      specialNote: sheet.specialNote,
      rows: sheet.rows,
    }),
    onSuccess: (saved) => {
      setLocalSheet(saved);
      setDirty(false);
      queryClient.invalidateQueries({ queryKey: ["/api/route-sheets", dateStr] });
      toast({ title: "ルート票を保存しました" });
    },
    onError: () => toast({ title: "保存に失敗しました", variant: "destructive" }),
  });

  // ── Row operations ────────────────────────────────────────────────────────
  function addRow() {
    mark({ ...sheet, rows: [...sheet.rows, emptyRow(sheet.rows.length)] });
  }
  function deleteRow(ri: number) {
    const rows = sheet.rows.filter((_, i) => i !== ri).map((r, i) => ({ ...r, sortOrder: i }));
    mark({ ...sheet, rows });
  }
  function updateStaff(ri: number, upd: Pick<SheetRow, "staffName" | "shiftType">) {
    const rows = sheet.rows.map((r, i) => i === ri ? { ...r, ...upd } : r);
    mark({ ...sheet, rows });
  }

  // ── Cell operations ───────────────────────────────────────────────────────
  function openAddCell(ri: number) {
    setCellModal({ rowIndex: ri, cellIndex: null, cell: emptyCell() });
  }
  function openEditCell(ri: number, ci: number) {
    setCellModal({ rowIndex: ri, cellIndex: ci, cell: { ...sheet.rows[ri].cells[ci] } });
  }
  function saveCell(ri: number, ci: number | null, cell: SheetCell) {
    const rows = sheet.rows.map((r, i) => {
      if (i !== ri) return r;
      let cells = [...r.cells];
      if (ci === null) cells = [...cells, cell];
      else cells[ci] = cell;
      cells.sort((a, b) => timeToMin(a.startTime) - timeToMin(b.startTime));
      return { ...r, cells };
    });
    mark({ ...sheet, rows });
  }
  function deleteCell(ri: number, ci: number) {
    const rows = sheet.rows.map((r, i) => {
      if (i !== ri) return r;
      return { ...r, cells: r.cells.filter((_, j) => j !== ci) };
    });
    mark({ ...sheet, rows });
  }

  const dateLabel = format(appDate, "yyyy年M月d日（E）", { locale: ja });
  const eraYear = appDate.getFullYear() - 2018; // Reiwa

  return (
    <Layout>
      <div className="space-y-3">
        {/* ── Header bar ── */}
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <GripVertical className="h-5 w-5 text-primary" />ルート票
          </h1>
          <div className="flex items-center gap-2">
            <DayNav date={appDate} onChange={setAppDate} />
            <Button
              variant="outline" size="sm"
              onClick={() => window.print()}
              className="gap-1.5"
            >
              <Printer className="h-4 w-4" />印刷
            </Button>
            <Button
              size="sm"
              disabled={!dirty || saveMutation.isPending}
              onClick={() => saveMutation.mutate()}
              className="gap-1.5"
            >
              <Save className="h-4 w-4" />{saveMutation.isPending ? "保存中..." : dirty ? "保存（変更あり）" : "保存済み"}
            </Button>
          </div>
        </div>

        {/* ── Sheet header meta ── */}
        <div className="bg-white rounded-xl border border-gray-200 p-3 space-y-2 print:border-0">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="text-sm font-semibold text-gray-600 shrink-0">
              令和{eraYear}年 {format(appDate, "M月d日（E）", { locale: ja })}
            </div>
            <Input
              value={sheet.headerNote ?? ""}
              onChange={(e) => mark({ ...sheet, headerNote: e.target.value })}
              placeholder="備考（例：第１・３ 亀岡内科往診（10:00〜）...）"
              className="flex-1 h-8 text-sm"
            />
          </div>
        </div>

        {/* ── Time grid ── */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden print:border-0">
          {isLoading ? (
            <div className="p-8 text-center text-gray-400 text-sm">読み込み中...</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse" style={{ minWidth: 1880 }}>
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="sticky left-0 z-10 bg-gray-50 w-20 px-2 py-1.5 text-xs font-semibold text-gray-600 border-r border-gray-200 text-center">名前</th>
                    <th className="w-12 px-1 py-1.5 text-xs font-semibold text-gray-600 border-r border-gray-200 text-center">勤務</th>
                    <th className="p-0">
                      <div className="relative" style={{ height: 24, minWidth: 1760 }}>
                        {HOURS.map((h) => (
                          <div
                            key={h}
                            style={{ left: `${(h * 60 - MIN_START) / TOTAL_MIN * 100}%` }}
                            className="absolute top-0 bottom-0 flex items-center"
                          >
                            <span className="text-[10px] text-gray-400 font-mono pl-0.5">{h}:00</span>
                          </div>
                        ))}
                      </div>
                    </th>
                    <th className="w-12 border-l border-gray-200"></th>
                  </tr>
                </thead>
                <tbody>
                  {sheet.rows.map((row, ri) => (
                    <tr key={ri} className="border-b border-gray-100 hover:bg-gray-50/50">
                      <td className="sticky left-0 z-10 bg-white border-r border-gray-200 px-2 py-1">
                        <button
                          onClick={() => setStaffModal({ row, rowIndex: ri })}
                          className="flex items-center gap-1 w-full hover:text-primary text-left"
                        >
                          <Pencil className="h-3 w-3 text-gray-300 shrink-0" />
                          <span className="text-xs font-semibold text-gray-700 truncate">{row.staffName || "（未設定）"}</span>
                        </button>
                      </td>
                      <td className="border-r border-gray-200 px-1 py-1 text-center">
                        <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded ${
                          row.shiftType === "明" ? "bg-purple-100 text-purple-700"
                          : row.shiftType === "早" ? "bg-blue-100 text-blue-700"
                          : row.shiftType === "日" ? "bg-green-100 text-green-700"
                          : row.shiftType === "遅" ? "bg-orange-100 text-orange-700"
                          : row.shiftType === "夜" ? "bg-gray-800 text-white"
                          : "bg-gray-100 text-gray-500"
                        }`}>{row.shiftType}</span>
                      </td>
                      <td className="p-0 border-r border-gray-100">
                        <TimelineRow
                          row={row}
                          rowIndex={ri}
                          onCellClick={openEditCell}
                          onAddCell={openAddCell}
                        />
                      </td>
                      <td className="px-2 py-1 text-center">
                        <button
                          onClick={() => deleteRow(ri)}
                          className="p-1 rounded text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ── Add staff button ── */}
        <Button variant="outline" size="sm" onClick={addRow} className="gap-1.5">
          <Plus className="h-4 w-4" />スタッフを追加
        </Button>

        {/* ── Day service + notes ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {/* デイサービス — linked to day-services data */}
          <div className="bg-white rounded-xl border border-gray-200 p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-500">
                デイサービス
                {todayServices.length > 0 && (
                  <span className="ml-1.5 text-primary font-bold">{todayServices.length}名</span>
                )}
              </span>
              <a
                href="/day-services"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs text-primary hover:underline"
              >
                <ExternalLink className="h-3 w-3" />詳細管理
              </a>
            </div>

            {todayServices.length === 0 ? (
              <p className="text-xs text-gray-400 py-1">本日のデイサービス予定はありません</p>
            ) : (
              <div className="space-y-1.5">
                {todayServices.map((svc) => (
                  <div
                    key={svc.id}
                    className={`flex items-start gap-2 rounded-lg p-2 border transition-colors ${
                      svc.isPrepared ? "border-green-200 bg-green-50/60" : "border-gray-100 bg-gray-50/50"
                    }`}
                  >
                    <button
                      onClick={() => handleTogglePrepared(svc.id)}
                      className={`mt-0.5 shrink-0 transition-colors ${
                        svc.isPrepared ? "text-green-500 hover:text-green-600" : "text-gray-300 hover:text-primary/60"
                      }`}
                    >
                      {svc.isPrepared
                        ? <CheckCircle2 className="h-5 w-5" />
                        : <Circle className="h-5 w-5" />}
                    </button>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-1.5 flex-wrap">
                        <span className="text-xs font-bold text-gray-800">{svc.residentName}様</span>
                        {svc.facilityName && (
                          <span className="text-[10px] text-gray-400">{svc.facilityName}</span>
                        )}
                      </div>
                      {svc.itemsToBring && (
                        <p className="text-[10px] text-gray-500 mt-0.5">
                          <span className="font-semibold">持参物：</span>{svc.itemsToBring}
                        </p>
                      )}
                      {svc.itemLocations && (
                        <p className="text-[10px] text-gray-400 mt-0.5">
                          <span className="font-semibold">置き場所：</span>{svc.itemLocations}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Optional supplementary memo */}
            <Input
              value={sheet.dayServiceNote ?? ""}
              onChange={(e) => mark({ ...sheet, dayServiceNote: e.target.value })}
              placeholder="担当者名・補足メモ"
              className="h-7 text-xs"
            />
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-3">
            <div className="text-xs font-semibold text-gray-500 mb-1.5">特記事項</div>
            <Textarea
              value={sheet.specialNote ?? ""}
              onChange={(e) => mark({ ...sheet, specialNote: e.target.value })}
              placeholder="特記事項を入力..."
              className="text-sm resize-none"
              rows={2}
            />
          </div>
        </div>
      </div>

      {/* ── Modals ── */}
      {cellModal && (
        <CellModal
          state={cellModal}
          onSave={saveCell}
          onDelete={deleteCell}
          onClose={() => setCellModal(null)}
        />
      )}
      {staffModal && (
        <StaffModal
          row={staffModal.row}
          rowIndex={staffModal.rowIndex}
          onSave={updateStaff}
          onClose={() => setStaffModal(null)}
        />
      )}
    </Layout>
  );
}
