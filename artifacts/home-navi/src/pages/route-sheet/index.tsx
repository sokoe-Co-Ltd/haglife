import { useState, useRef } from "react";
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
  Save, Printer, CheckCircle2, Circle, ExternalLink, Pencil, Trash2, Coffee,
} from "lucide-react";

// ── Constants ──────────────────────────────────────────────────────────────────
const SLOT_MIN = 15;
const SLOT_W   = 28;            // px per 15-min slot
const GRID_START = 60;          // 1:00 in minutes
const GRID_END   = 1380;        // 23:00 in minutes
const TOTAL_SLOTS = (GRID_END - GRID_START) / SLOT_MIN; // 88
const TOTAL_W     = TOTAL_SLOTS * SLOT_W;               // 2464 px
const NAME_W = 80;              // px — sticky name column
const SHIFT_W = 48;             // px — sticky shift column

const HOURS = Array.from({ length: 22 }, (_, i) => i + 1); // 1–22

const DEFAULT_SHIFTS = [
  { shiftType: "明", sortOrder: 0 },
  { shiftType: "早", sortOrder: 1 },
  { shiftType: "早", sortOrder: 2 },
  { shiftType: "日", sortOrder: 3 },
  { shiftType: "遅", sortOrder: 4 },
  { shiftType: "遅", sortOrder: 5 },
  { shiftType: "夜", sortOrder: 6 },
];

const SERVICE_CARDS = [
  { id: "身0",       label: "身0",          fullLabel: "身０",         durationMin: 15, isBreak: false, color: "blue"  },
  { id: "身1排泄",   label: "身1 排泄",     fullLabel: "身１\n排泄",   durationMin: 30, isBreak: false, color: "blue"  },
  { id: "身1食介",   label: "身1食介",      fullLabel: "身１\n食介",   durationMin: 30, isBreak: false, color: "blue"  },
  { id: "身2入浴",   label: "身2 入浴",     fullLabel: "身２\n入浴",   durationMin: 60, isBreak: false, color: "cyan"  },
  { id: "生2掃洗",   label: "生2 掃・洗",   fullLabel: "生２\n掃・洗",   durationMin: 30, isBreak: false, color: "green" },
  { id: "生3掃洗シ", label: "生3 掃・洗・シ", fullLabel: "生３\n掃・洗・シ", durationMin: 60, isBreak: false, color: "green" },
  { id: "休憩",      label: "休憩 60分",    fullLabel: "休憩",         durationMin: 60, isBreak: true,  color: "amber" },
] as const;

type ServiceCard = typeof SERVICE_CARDS[number];

const CARD_CLS: Record<string, string> = {
  blue:  "bg-blue-50  border-blue-200  text-blue-800",
  green: "bg-green-50 border-green-200 text-green-800",
  cyan:  "bg-cyan-50  border-cyan-200  text-cyan-800",
  amber: "bg-amber-50 border-amber-200 text-amber-800",
};

// CSS grid lines via background-image (efficient — no DOM nodes)
const gridBg = {
  backgroundImage: [
    `repeating-linear-gradient(to right, #f3f4f6 0, #f3f4f6 1px, transparent 1px, transparent ${SLOT_W}px)`,
    `repeating-linear-gradient(to right, #e5e7eb 0, #e5e7eb 1px, transparent 1px, transparent ${SLOT_W * 4}px)`,
  ].join(", "),
};

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
interface CellModalState {
  rowIndex: number;
  cellIndex: number | null;
  cell: SheetCell;
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function timeToMin(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}
function minToTime(min: number): string {
  const clamped = Math.max(0, Math.min(1439, min));
  return `${String(Math.floor(clamped / 60)).padStart(2, "0")}:${String(clamped % 60).padStart(2, "0")}`;
}
function cellLeft(t: string): number {
  return (Math.max(GRID_START, Math.min(GRID_END, timeToMin(t))) - GRID_START) / SLOT_MIN * SLOT_W;
}
function cellWidth(s: string, e: string): number {
  return Math.max(SLOT_W, (timeToMin(e) - timeToMin(s)) / SLOT_MIN * SLOT_W);
}
function cellBg(cell: SheetCell): string {
  if (cell.isBreak) return "bg-amber-100 border-amber-300 text-amber-800";
  const lbl = cell.serviceLabel ?? "";
  if (/^身[０-３0-3]/.test(lbl)) return "bg-blue-100 border-blue-300 text-blue-900";
  if (/^生[２-３2-3]/.test(lbl)) return "bg-green-100 border-green-300 text-green-900";
  return "bg-gray-100 border-gray-300 text-gray-800";
}
function shiftBg(t: string): string {
  if (t === "明") return "bg-purple-100 text-purple-700";
  if (t === "早") return "bg-blue-100 text-blue-700";
  if (t === "日") return "bg-green-100 text-green-700";
  if (t === "遅") return "bg-orange-100 text-orange-700";
  if (t === "夜") return "bg-gray-800 text-white";
  return "bg-gray-100 text-gray-600";
}
function emptySheet(date: string): RouteSheetData {
  return { date, headerNote: "", dayServiceNote: "", specialNote: "", rows: [] };
}
function defaultRows(): SheetRow[] {
  return DEFAULT_SHIFTS.map((s) => ({ staffName: "", shiftType: s.shiftType, sortOrder: s.sortOrder, cells: [] }));
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

// ── CellBlock ──────────────────────────────────────────────────────────────────
function CellBlock({ cell, onClick }: { cell: SheetCell; onClick: () => void }) {
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      style={{ left: cellLeft(cell.startTime), width: cellWidth(cell.startTime, cell.endTime) }}
      className={`absolute top-0.5 bottom-0.5 border rounded text-left overflow-hidden px-1 hover:opacity-80 transition-opacity cursor-pointer z-10 ${cellBg(cell)}`}
    >
      {cell.isBreak ? (
        <span className="flex items-center gap-0.5 text-[9px] font-bold h-full">
          <Coffee className="h-2.5 w-2.5 shrink-0" />休憩
        </span>
      ) : (
        <div className="flex flex-col justify-center h-full">
          <div className="text-[9px] font-semibold leading-tight truncate">{cell.residentName || "─"}</div>
          <div className="text-[8px] opacity-75 leading-tight truncate whitespace-pre-line">{cell.serviceLabel}</div>
        </div>
      )}
    </button>
  );
}

// ── CellModal ──────────────────────────────────────────────────────────────────
function CellModal({ state, onSave, onDelete, onClose }: {
  state: CellModalState;
  onSave: (ri: number, ci: number | null, cell: SheetCell) => void;
  onDelete: (ri: number, ci: number) => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState<SheetCell>(state.cell);
  const set = (k: keyof SheetCell, v: any) => setForm((p) => ({ ...p, [k]: v }));

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{state.cellIndex !== null ? "訪問を編集" : "訪問を配置"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <label className="text-xs w-12 shrink-0">休憩</label>
            <Checkbox checked={form.isBreak} onCheckedChange={(v) => set("isBreak", !!v)} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">開始</label>
              <Input type="time" value={form.startTime} onChange={(e) => set("startTime", e.target.value)} className="h-8 text-sm" step={900} />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">終了</label>
              <Input type="time" value={form.endTime} onChange={(e) => set("endTime", e.target.value)} className="h-8 text-sm" step={900} />
            </div>
          </div>
          {!form.isBreak && (
            <>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">利用者名</label>
                <Input
                  autoFocus
                  value={form.residentName ?? ""}
                  onChange={(e) => set("residentName", e.target.value)}
                  placeholder="山田 花子"
                  className="h-8 text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">サービス種別</label>
                <Input
                  value={form.serviceLabel ?? ""}
                  onChange={(e) => set("serviceLabel", e.target.value)}
                  placeholder="身０ など"
                  className="h-8 text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">メモ</label>
                <Input
                  value={form.notes ?? ""}
                  onChange={(e) => set("notes", e.target.value)}
                  placeholder="備考"
                  className="h-8 text-sm"
                />
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

  // ── Day services ─────────────────────────────────────────────────────────
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

  // ── Local state ──────────────────────────────────────────────────────────
  const [localSheet, setLocalSheet] = useState<RouteSheetData | null>(null);
  const [dirty, setDirty] = useState(false);
  const [cellModal, setCellModal] = useState<CellModalState | null>(null);
  const [dragOverRow, setDragOverRow] = useState<number | null>(null);
  const [editingName, setEditingName] = useState<number | null>(null);
  const [nameInput, setNameInput] = useState("");

  // Reset local state on date change
  const prevDate = useRef(dateStr);
  if (prevDate.current !== dateStr) {
    prevDate.current = dateStr;
    setLocalSheet(null);
    setDirty(false);
  }

  const rawSheet = localSheet ?? loaded ?? emptySheet(dateStr);
  const sheet: RouteSheetData = {
    ...rawSheet,
    rows: rawSheet.rows.length > 0 ? rawSheet.rows : defaultRows(),
  };

  function mark(updated: RouteSheetData) {
    setLocalSheet(updated);
    setDirty(true);
  }

  // ── Save ──────────────────────────────────────────────────────────────────
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

  // ── Staff name edit (inline) ─────────────────────────────────────────────
  function startEditName(ri: number) {
    setEditingName(ri);
    setNameInput(sheet.rows[ri].staffName);
  }
  function commitName(ri: number) {
    const rows = sheet.rows.map((r, i) => i === ri ? { ...r, staffName: nameInput } : r);
    mark({ ...sheet, rows });
    setEditingName(null);
  }

  // ── Cell operations ──────────────────────────────────────────────────────
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
    const rows = sheet.rows.map((r, i) =>
      i !== ri ? r : { ...r, cells: r.cells.filter((_, j) => j !== ci) }
    );
    mark({ ...sheet, rows });
  }

  // ── Drag & Drop ──────────────────────────────────────────────────────────
  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  }
  function handleDrop(e: React.DragEvent, ri: number) {
    e.preventDefault();
    setDragOverRow(null);
    const raw = e.dataTransfer.getData("application/json");
    if (!raw) return;
    let card: ServiceCard;
    try { card = JSON.parse(raw); } catch { return; }

    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const x = e.clientX - rect.left;
    const slotIndex = Math.max(0, Math.min(TOTAL_SLOTS - 1, Math.floor(x / SLOT_W)));
    const startMin = GRID_START + slotIndex * SLOT_MIN;
    const endMin = Math.min(GRID_END, startMin + card.durationMin);

    setCellModal({
      rowIndex: ri,
      cellIndex: null,
      cell: {
        startTime: minToTime(startMin),
        endTime: minToTime(endMin),
        isBreak: card.isBreak,
        residentName: "",
        serviceLabel: card.fullLabel,
      },
    });
  }

  const eraYear = appDate.getFullYear() - 2018;

  return (
    <Layout>
      <div className="space-y-3">
        {/* ── Header ── */}
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <h1 className="text-xl font-bold text-gray-800">ルート票</h1>
          <div className="flex items-center gap-2 flex-wrap">
            <DayNav date={appDate} onChange={setAppDate} />
            <Button variant="outline" size="sm" onClick={() => window.print()} className="gap-1.5">
              <Printer className="h-4 w-4" />印刷
            </Button>
            <Button
              size="sm"
              disabled={!dirty || saveMutation.isPending}
              onClick={() => saveMutation.mutate()}
              className="gap-1.5"
            >
              <Save className="h-4 w-4" />
              {saveMutation.isPending ? "保存中..." : dirty ? "保存（変更あり）" : "保存済み"}
            </Button>
          </div>
        </div>

        {/* ── Header note ── */}
        <div className="bg-white rounded-xl border border-gray-200 p-3">
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

        {/* ── Service card palette ── */}
        <div className="bg-white rounded-xl border border-gray-200 p-3">
          <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-2">
            サービスカード ─ ドラッグしてスタッフ行へ配置
          </div>
          <div className="flex flex-wrap gap-2">
            {SERVICE_CARDS.map((card) => (
              <div
                key={card.id}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData("application/json", JSON.stringify(card));
                  e.dataTransfer.effectAllowed = "copy";
                }}
                className={`cursor-grab active:cursor-grabbing border rounded-lg px-3 py-2 select-none text-center min-w-[76px] transition-transform hover:scale-105 active:scale-95 shadow-sm ${CARD_CLS[card.color]}`}
              >
                <div className="text-xs font-bold leading-tight">{card.label}</div>
                <div className="text-[10px] opacity-60 mt-0.5">{card.durationMin}分</div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Time grid ── */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {isLoading ? (
            <div className="p-8 text-center text-gray-400 text-sm">読み込み中...</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="border-collapse" style={{ width: NAME_W + SHIFT_W + TOTAL_W }}>
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th
                      className="sticky z-30 bg-gray-50 border-r border-gray-200 text-xs font-semibold text-gray-500 text-center px-1 py-1.5"
                      style={{ left: 0, width: NAME_W, minWidth: NAME_W }}
                    >名前</th>
                    <th
                      className="sticky z-30 bg-gray-50 border-r border-gray-200 text-xs font-semibold text-gray-500 text-center px-1 py-1.5"
                      style={{ left: NAME_W, width: SHIFT_W, minWidth: SHIFT_W }}
                    >勤務</th>
                    <th className="p-0" style={{ width: TOTAL_W }}>
                      {/* Hour labels */}
                      <div className="relative bg-gray-50" style={{ height: 20, width: TOTAL_W }}>
                        {HOURS.map((h) => {
                          const left = (h * 60 - GRID_START) / SLOT_MIN * SLOT_W;
                          return (
                            <div key={h} style={{ left }} className="absolute top-0 bottom-0 flex items-center">
                              <span className="text-[9px] text-gray-400 font-mono pl-0.5">{h}:00</span>
                            </div>
                          );
                        })}
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sheet.rows.map((row, ri) => (
                    <tr
                      key={ri}
                      className={`border-b border-gray-100 transition-colors ${
                        dragOverRow === ri ? "bg-primary/5" : ""
                      }`}
                    >
                      {/* Staff name — sticky, inline-edit on click */}
                      <td
                        className="sticky z-20 bg-white border-r border-gray-200 px-2 py-0"
                        style={{ left: 0, width: NAME_W, minWidth: NAME_W }}
                      >
                        {editingName === ri ? (
                          <input
                            autoFocus
                            value={nameInput}
                            onChange={(e) => setNameInput(e.target.value)}
                            onBlur={() => commitName(ri)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") commitName(ri);
                              if (e.key === "Escape") setEditingName(null);
                            }}
                            className="w-full text-xs border-b border-primary outline-none bg-transparent py-2"
                          />
                        ) : (
                          <button
                            onClick={() => startEditName(ri)}
                            className="flex items-center gap-1 w-full text-left py-2 hover:text-primary group"
                          >
                            <Pencil className="h-2.5 w-2.5 text-gray-200 group-hover:text-primary shrink-0" />
                            <span className="text-xs font-medium text-gray-700 truncate">
                              {row.staffName || "─"}
                            </span>
                          </button>
                        )}
                      </td>

                      {/* Shift badge — sticky */}
                      <td
                        className="sticky z-20 bg-white border-r border-gray-200 px-1 text-center"
                        style={{ left: NAME_W, width: SHIFT_W, minWidth: SHIFT_W }}
                      >
                        <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded ${shiftBg(row.shiftType)}`}>
                          {row.shiftType}
                        </span>
                      </td>

                      {/* Timeline — drop target */}
                      <td
                        className="p-0 cursor-crosshair"
                        style={{ width: TOTAL_W }}
                        onDragOver={handleDragOver}
                        onDragEnter={() => setDragOverRow(ri)}
                        onDragLeave={(e) => {
                          if (!(e.currentTarget as HTMLElement).contains(e.relatedTarget as Node)) {
                            setDragOverRow(null);
                          }
                        }}
                        onDrop={(e) => handleDrop(e, ri)}
                      >
                        <div
                          className="relative"
                          style={{ height: 40, width: TOTAL_W, ...gridBg }}
                        >
                          {row.cells.map((cell, ci) => (
                            <CellBlock key={ci} cell={cell} onClick={() => openEditCell(ri, ci)} />
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ── Day service + special notes ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {/* デイサービス — linked */}
          <div className="bg-white rounded-xl border border-gray-200 p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-500">
                デイサービス
                {todayServices.length > 0 && (
                  <span className="ml-1.5 text-primary font-bold">{todayServices.length}名</span>
                )}
              </span>
              <a href="/day-services" className="flex items-center gap-1 text-xs text-primary hover:underline">
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
                      {svc.isPrepared ? <CheckCircle2 className="h-5 w-5" /> : <Circle className="h-5 w-5" />}
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

            <Input
              value={sheet.dayServiceNote ?? ""}
              onChange={(e) => mark({ ...sheet, dayServiceNote: e.target.value })}
              placeholder="担当者名・補足メモ"
              className="h-7 text-xs"
            />
          </div>

          {/* 特記事項 */}
          <div className="bg-white rounded-xl border border-gray-200 p-3">
            <div className="text-xs font-semibold text-gray-500 mb-1.5">特記事項</div>
            <Textarea
              value={sheet.specialNote ?? ""}
              onChange={(e) => mark({ ...sheet, specialNote: e.target.value })}
              placeholder="特記事項を入力..."
              className="text-sm resize-none"
              rows={3}
            />
          </div>
        </div>
      </div>

      {/* ── Modal ── */}
      {cellModal && (
        <CellModal
          state={cellModal}
          onSave={saveCell}
          onDelete={deleteCell}
          onClose={() => setCellModal(null)}
        />
      )}
    </Layout>
  );
}
