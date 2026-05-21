import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { useSearch } from "wouter";
import { Layout } from "@/components/layout";
import { useAppDate } from "@/contexts/AppDateContext";
import { DayNav } from "@/components/date-nav";
import { format, parseISO, isValid } from "date-fns";
import { ja } from "date-fns/locale";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import {
  useListResidents,
  useListDayServices,
  useToggleDayServicePrepared,
  getListDayServicesQueryKey,
  useListServiceTypes,
  useListShifts,
  useListStaff,
  useListShiftTypes,
} from "@workspace/api-client-react";
import { ConflictBanner } from "@/components/route-sheet/ConflictBanner";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Save, Printer, CheckCircle2, Circle, ExternalLink, Pencil, Trash2, Coffee,
  UserRound, X, AlertTriangle,
} from "lucide-react";
import {
  DndContext, DragOverlay, useDraggable, useDroppable, useSensor, useSensors,
  PointerSensor, KeyboardSensor,
  type DragStartEvent, type DragMoveEvent, type DragEndEvent,
} from "@dnd-kit/core";

// ── Constants ──────────────────────────────────────────────────────────────────
const SLOT_MIN = 15;
const SLOT_W   = 28;            // px per 15-min slot
const GRID_START = 60;          // 1:00 in minutes
const GRID_END   = 1380;        // 23:00 in minutes
const TOTAL_SLOTS = (GRID_END - GRID_START) / SLOT_MIN; // 88
const TOTAL_W     = TOTAL_SLOTS * SLOT_W;               // 2464 px
const NAME_W = 80;              // px — sticky name column
const SHIFT_W = 48;             // px — sticky shift column
const ROW_H = 40;               // px — row timeline height

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

// Hours displayed (1:00 .. 22:00, each spans 4 * SLOT_W = 112px)
const HOURS_LIST: number[] = Array.from(
  { length: (GRID_END - GRID_START) / 60 },
  (_, i) => 1 + i,
);

// Distinct pale color per hour band so users can tell which hour they're in.
// Uses the golden-angle (~137.508°) so adjacent hours land far apart on the
// hue wheel — preventing same-family colors from sitting next to each other.
function hourBandColor(h: number): string {
  const hue = ((h - 1) * 137.508) % 360;
  return `hsl(${hue}, 70%, 94%)`;
}

// Renders alternating colored bands behind every hour (1 div per hour).
function HourBands() {
  return (
    <div className="absolute inset-0 pointer-events-none" aria-hidden>
      {HOURS_LIST.map((h, i) => (
        <div
          key={h}
          className="absolute top-0 bottom-0"
          style={{
            left: i * SLOT_W * 4,
            width: SLOT_W * 4,
            background: hourBandColor(h),
          }}
        />
      ))}
    </div>
  );
}

// Renders the always-visible vertical grid lines as actual DOM nodes — one
// per 15-min slot. Hour boundaries (every 4th line) are bolder so the eye
// can chunk by hour while still seeing every 15-min tick.
function GridLines() {
  return (
    <div className="absolute inset-0 pointer-events-none" aria-hidden>
      {Array.from({ length: TOTAL_SLOTS + 1 }).map((_, i) => {
        const isHour = i % 4 === 0;
        return (
          <div
            key={i}
            className="absolute top-0 bottom-0"
            style={{
              left: i * SLOT_W,
              width: isHour ? 2 : 1,
              background: isHour ? "#475569" : "#94a3b8",
            }}
          />
        );
      })}
    </div>
  );
}

// ── Types ──────────────────────────────────────────────────────────────────────
type VisitConflictItem = {
  cellAId: number;
  cellBId: number;
  staffId?: number | null;
  aStart: string;
  aEnd: string;
  bStart: string;
  bEnd: string;
};
type SheetCell = {
  id?: number;
  startTime: string;
  endTime: string;
  isBreak: boolean;
  residentName?: string | null;
  serviceLabel?: string | null;
  notes?: string | null;
  residentId?: number | null;
  serviceTypeId?: string | null;
};
type SheetRow = {
  id?: number;
  staffName: string;
  shiftType: string;
  sortOrder: number;
  staffId?: number | null;
  cells: SheetCell[];
};
type RouteSheetData = {
  id?: number;
  date: string;
  headerNote?: string | null;
  dayServiceNote?: string | null;
  specialNote?: string | null;
  rows: SheetRow[];
  conflicts?: VisitConflictItem[];
};
interface CellModalState {
  rowIndex: number;
  cellIndex: number | null;
  cell: SheetCell;
}
type SheetApiResponse = RouteSheetData & {
  source?: "instance" | "template" | "empty";
  templateId?: string;
  weekday?: number;
};

type DragPayload =
  | { kind: "palette"; card: ServiceCard }
  | { kind: "placed"; rowIdx: number; cellIdx: number; cell: SheetCell };

type DragState = {
  payload: DragPayload;
  duplicate: boolean;
  // Constant during a drag — used for snap math and ghost rendering
  ghostW: number;
  ghostH: number;
  // Cursor position in viewport (updated each onDragMove) — drives ghost rendering
  cursorX: number;
  cursorY: number;
  // Updated by onDragMove
  overRowIdx: number | null;
  overSlotIndex: number | null;
  colliding: boolean;
};

type MoveMode = { rowIdx: number; cellIdx: number } | null;

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
function addMinutes(hhmm: string, mins: number): string {
  const [h, m] = hhmm.split(":").map(Number);
  const total = h * 60 + m + mins;
  const nh = Math.floor(total / 60) % 24;
  const nm = total % 60;
  return `${String(nh).padStart(2, "0")}:${String(nm).padStart(2, "0")}`;
}
function durationOf(cell: SheetCell): number {
  return Math.max(SLOT_MIN, timeToMin(cell.endTime) - timeToMin(cell.startTime));
}
function snapSlotIndex(slotIndex: number): number {
  return Math.max(0, Math.min(TOTAL_SLOTS - 1, Math.round(slotIndex)));
}
function dragDurationMin(payload: DragPayload): number {
  return payload.kind === "palette" ? payload.card.durationMin : durationOf(payload.cell);
}
function isOverlap(aStart: number, aEnd: number, bStart: number, bEnd: number) {
  return aStart < bEnd && bStart < aEnd;
}
function detectCollision(
  rows: SheetRow[], rowIdx: number, startMin: number, endMin: number,
  excludeRowIdx?: number, excludeCellIdx?: number,
): boolean {
  const row = rows[rowIdx];
  if (!row) return false;
  return row.cells.some((c, ci) => {
    if (excludeRowIdx === rowIdx && excludeCellIdx === ci) return false;
    return isOverlap(startMin, endMin, timeToMin(c.startTime), timeToMin(c.endTime));
  });
}

// ── API ────────────────────────────────────────────────────────────────────────
async function fetchSheet(date: string): Promise<SheetApiResponse> {
  const r = await fetch(`/api/route-sheets?date=${date}`);
  if (!r.ok) throw new Error("Failed to fetch");
  const data = await r.json();
  if (data === null) return { source: "empty", date, rows: [] };
  return data;
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

// ── DraggableCell ─────────────────────────────────────────────────────────────
function DraggableCell({
  cell, rowIdx, cellIdx, isConflict, isMoveTarget, disabled, onClick,
}: {
  cell: SheetCell; rowIdx: number; cellIdx: number;
  isConflict?: boolean; isMoveTarget?: boolean; disabled?: boolean;
  onClick: () => void;
}) {
  const id = `placed:${rowIdx}:${cellIdx}`;
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id,
    disabled,
    data: { kind: "placed", rowIdx, cellIdx, cell } satisfies DragPayload,
  });

  return (
    <button
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      style={{ left: cellLeft(cell.startTime), width: cellWidth(cell.startTime, cell.endTime) }}
      className={`absolute top-0.5 bottom-0.5 border rounded text-left overflow-hidden px-1 hover:opacity-80 transition-opacity cursor-grab active:cursor-grabbing z-10 touch-none ${cellBg(cell)} ${isConflict ? "ring-2 ring-red-500 ring-offset-1 z-20" : ""} ${isDragging ? "opacity-30" : ""} ${isMoveTarget ? "animate-pulse ring-2 ring-blue-500 ring-offset-1 z-20" : ""}`}
    >
      {cell.isBreak ? (
        <span className="flex items-center gap-0.5 text-[9px] font-bold h-full">
          <Coffee className="h-2.5 w-2.5 shrink-0" />休憩
        </span>
      ) : (
        <div className="flex flex-col justify-center h-full relative">
          <div className="text-[9px] font-semibold leading-tight truncate">{cell.residentName || "─"}</div>
          <div className="text-[8px] opacity-75 leading-tight truncate whitespace-pre-line">{cell.serviceLabel}</div>
          {isConflict && (
            <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-red-500 rounded-full" />
          )}
        </div>
      )}
    </button>
  );
}

// ── PaletteCard ───────────────────────────────────────────────────────────────
function PaletteCard({ card, hasResident }: { card: ServiceCard; hasResident: boolean }) {
  const id = `palette:${card.id}`;
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id,
    data: { kind: "palette", card } satisfies DragPayload,
  });
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={`cursor-grab active:cursor-grabbing border rounded-lg px-3 py-2 select-none text-center min-w-[76px] transition-transform hover:scale-105 active:scale-95 shadow-sm touch-none ${CARD_CLS[card.color]} ${hasResident && !card.isBreak ? "ring-2 ring-primary/40 ring-offset-1" : ""} ${isDragging ? "opacity-30" : ""}`}
    >
      <div className="text-xs font-bold leading-tight">{card.label}</div>
      <div className="text-[10px] opacity-60 mt-0.5">{card.durationMin}分</div>
    </div>
  );
}

// ── RowTimeline (Droppable) ───────────────────────────────────────────────────
function RowTimeline({
  rowIdx, children, isDragActive, isOver, dropIndicator, registerRef, onTrackClick,
}: {
  rowIdx: number;
  children: React.ReactNode;
  isDragActive: boolean;
  isOver: boolean;
  dropIndicator: { slotIndex: number; widthPx: number; colliding: boolean } | null;
  registerRef: (rowIdx: number, el: HTMLDivElement | null) => void;
  onTrackClick: (rowIdx: number, slotIndex: number, evt: React.MouseEvent) => void;
}) {
  const { setNodeRef } = useDroppable({ id: `row:${rowIdx}`, data: { rowIdx } });

  return (
    <div
      ref={(node) => {
        setNodeRef(node);
        registerRef(rowIdx, node);
      }}
      className={`relative ${isOver ? "ring-2 ring-inset ring-blue-300" : ""}`}
      style={{ height: ROW_H, width: TOTAL_W }}
      onClick={(e) => {
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        const x = e.clientX - rect.left;
        const slotIndex = snapSlotIndex(x / SLOT_W);
        onTrackClick(rowIdx, slotIndex, e);
      }}
    >
      {/* Hour-band colored backgrounds (always visible) */}
      <HourBands />
      {/* 15-min and 60-min vertical grid lines (always visible) */}
      <GridLines />
      {/* Extra darker 15-min grid during drag for precision */}
      {isDragActive && (
        <div
          className="absolute inset-0 pointer-events-none"
          aria-hidden
          style={{
            backgroundImage: `repeating-linear-gradient(to right, rgba(37,99,235,0.35) 0, rgba(37,99,235,0.35) 1px, transparent 1px, transparent ${SLOT_W}px)`,
          }}
        />
      )}
      {/* Snapped drop-zone indicator (on the over row only) */}
      {dropIndicator && (
        <div
          aria-hidden
          className={`absolute top-0.5 bottom-0.5 rounded pointer-events-none border-2 z-0 ${
            dropIndicator.colliding
              ? "bg-red-300/40 border-red-500"
              : "bg-blue-300/40 border-blue-500"
          }`}
          style={{
            left: dropIndicator.slotIndex * SLOT_W,
            width: dropIndicator.widthPx,
          }}
        />
      )}
      {children}
    </div>
  );
}

// ── CellModal ──────────────────────────────────────────────────────────────────
type StaffOption = { staffId: number; name: string; shiftCode: string | null };

function CellModal({
  state, residents, staffOptions, currentStaffId, isTemplateView,
  onSave, onDelete, onClose,
}: {
  state: CellModalState;
  residents: { id: number; name: string }[];
  staffOptions: StaffOption[];
  currentStaffId: number | null;
  isTemplateView: boolean;
  onSave: (ri: number, ci: number | null, cell: SheetCell, newStaffId: number | null | undefined) => void;
  onDelete: (ri: number, ci: number) => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState<SheetCell>(state.cell);
  const [staffId, setStaffId] = useState<number | null>(currentStaffId);
  const [errors, setErrors] = useState<{ resident?: string; serviceType?: string }>({});
  const set = (k: keyof SheetCell, v: any) => setForm((p) => ({ ...p, [k]: v }));
  const { data: serviceTypes = [] } = useListServiceTypes({ isActive: true } as any);

  function handleSave() {
    const errs: typeof errors = {};
    if (!form.isBreak) {
      if (!form.residentId) errs.resident = "利用者を選択してください";
      if (!form.serviceTypeId) errs.serviceType = "サービス種別を選択してください";
    }
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }
    const newStaffId = isTemplateView ? undefined : staffId;
    onSave(state.rowIndex, state.cellIndex, form, newStaffId);
    onClose();
  }

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
          {!isTemplateView && (
            <div>
              <label className="text-xs text-gray-500 mb-1 block">担当者</label>
              <select
                value={staffId?.toString() ?? ""}
                onChange={(e) => setStaffId(e.target.value ? parseInt(e.target.value) : null)}
                className="w-full h-8 px-2 text-sm border border-input rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                <option value="">（未割当）</option>
                {staffOptions.map((s) => (
                  <option key={s.staffId} value={s.staffId}>
                    {s.name}{s.shiftCode ? `（${s.shiftCode}）` : ""}
                  </option>
                ))}
              </select>
            </div>
          )}
          {!form.isBreak && (
            <>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">
                  利用者 <span className="text-red-500">*</span>
                </label>
                <select
                  autoFocus
                  value={form.residentId?.toString() ?? ""}
                  onChange={(e) => {
                    const id = e.target.value ? parseInt(e.target.value) : null;
                    const resident = id ? residents.find((r) => r.id === id) : null;
                    setForm((p) => ({
                      ...p,
                      residentId: id,
                      residentName: resident ? resident.name : null,
                    }));
                    if (id) setErrors((p) => ({ ...p, resident: undefined }));
                  }}
                  className={`w-full h-8 px-2 text-sm border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 ${errors.resident ? "border-red-500" : "border-input"}`}
                >
                  <option value="">（未選択）</option>
                  {residents.map((r) => (
                    <option key={r.id} value={r.id}>{r.name}</option>
                  ))}
                </select>
                {errors.resident && (
                  <p className="text-[10px] text-red-600 mt-0.5">{errors.resident}</p>
                )}
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">
                  サービス種別 <span className="text-red-500">*</span>
                </label>
                <select
                  value={form.serviceTypeId ?? ""}
                  onChange={(e) => {
                    const id = e.target.value || null;
                    const st = id ? (serviceTypes as any[]).find((s) => s.id === id) : null;
                    setForm((p) => ({
                      ...p,
                      serviceTypeId: id,
                      serviceLabel: st ? st.shortLabel : null,
                      endTime: (st && p.startTime) ? addMinutes(p.startTime, st.durationMinutes) : p.endTime,
                    }));
                    if (id) setErrors((p) => ({ ...p, serviceType: undefined }));
                  }}
                  className={`w-full h-8 px-2 text-sm border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 ${errors.serviceType ? "border-red-500" : "border-input"}`}
                >
                  <option value="">（未選択）</option>
                  {(serviceTypes as any[]).map((st) => (
                    <option key={st.id} value={st.id}>
                      {st.name}（{st.durationMinutes}分）
                    </option>
                  ))}
                </select>
                {errors.serviceType && (
                  <p className="text-[10px] text-red-600 mt-0.5">{errors.serviceType}</p>
                )}
                {form.serviceTypeId && (
                  <p className="text-[10px] text-gray-400 mt-0.5">
                    略称: {(serviceTypes as any[]).find((s) => s.id === form.serviceTypeId)?.shortLabel} ／ 終了時刻自動計算済み
                  </p>
                )}
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
          <Button size="sm" onClick={handleSave}>保存</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────
export default function RouteSheetPage() {
  const { appDate, setAppDate } = useAppDate();
  const search = useSearch();
  useEffect(() => {
    const urlDate = new URLSearchParams(search).get("date");
    if (!urlDate) return;
    const parsed = parseISO(urlDate);
    if (!isValid(parsed)) return;
    if (format(parsed, "yyyy-MM-dd") !== format(appDate, "yyyy-MM-dd")) {
      setAppDate(parsed);
    }
  }, [search]);
  const dateStr = format(appDate, "yyyy-MM-dd");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: loaded, isLoading } = useQuery<SheetApiResponse>({
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
    togglePrepared.mutate({ id } as any, {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: getListDayServicesQueryKey() }),
    });
  }

  // ── Residents list ────────────────────────────────────────────────────────
  const { data: allResidents = [] } = useListResidents();
  const residents: { id: number; name: string }[] = (allResidents as any[])
    .filter((r) => !r.movedOutAt && r.isVisible !== false)
    .map((r) => ({ id: r.id as number, name: `${r.lastName} ${r.firstName}` }));

  // ── Staff options for assignee dropdown (today's shift workers only) ─────
  const { data: shiftsToday = [] } = useListShifts({ date: dateStr } as any);
  const { data: allStaff = [] } = useListStaff();
  const { data: allShiftTypes = [] } = useListShiftTypes();
  const staffOptions: StaffOption[] = useMemo(() => {
    const seen = new Set<number>();
    const opts: StaffOption[] = [];
    for (const s of (shiftsToday as any[])) {
      const sid = s.staffId as number;
      if (seen.has(sid)) continue;
      seen.add(sid);
      const staff = (allStaff as any[]).find((x) => x.id === sid);
      if (!staff) continue;
      const st = (allShiftTypes as any[]).find((x) => x.id === s.shiftTypeId);
      opts.push({
        staffId: sid,
        name: `${staff.lastName} ${staff.firstName}`,
        shiftCode: st?.code ?? null,
      });
    }
    return opts;
  }, [shiftsToday, allStaff, allShiftTypes]);

  // ── Local state ──────────────────────────────────────────────────────────
  const [localSheet, setLocalSheet] = useState<RouteSheetData | null>(null);
  const [dirty, setDirty] = useState(false);
  const [cellModal, setCellModal] = useState<CellModalState | null>(null);
  const [editingName, setEditingName] = useState<number | null>(null);
  const [nameInput, setNameInput] = useState("");
  const [selectedResident, setSelectedResident] = useState<{ id: number; name: string } | null>(null);

  // DnD + tap state
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [moveMode, setMoveMode] = useState<MoveMode>(null);
  const rowRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const registerRowRef = useCallback((rowIdx: number, el: HTMLDivElement | null) => {
    if (el) rowRefs.current.set(rowIdx, el);
    else rowRefs.current.delete(rowIdx);
  }, []);

  // Reset local state on date change
  const prevDate = useRef(dateStr);
  if (prevDate.current !== dateStr) {
    prevDate.current = dateStr;
    setLocalSheet(null);
    setDirty(false);
    setMoveMode(null);
  }

  const rawSheet = localSheet ?? loaded ?? emptySheet(dateStr);
  const sheet: RouteSheetData = {
    ...rawSheet,
    rows: rawSheet.rows.length > 0 ? rawSheet.rows : defaultRows(),
  };

  // source: drives banner display
  const source = dirty ? "instance" : (loaded?.source ?? "empty");
  const isTemplateView = source === "template";

  // Conflicts come from the last server response (loaded), not from local edits
  const conflicts: VisitConflictItem[] = (loaded as any)?.conflicts ?? [];
  const conflictCellIds = new Set<number>();
  conflicts.forEach((c) => { conflictCellIds.add(c.cellAId); conflictCellIds.add(c.cellBId); });

  // Build lookup maps for ConflictBanner
  const cellsById: Record<number, { residentName?: string | null; startTime: string }> = {};
  const rowsByCellId: Record<number, { staffName?: string | null }> = {};
  sheet.rows.forEach((row) => {
    row.cells.forEach((cell) => {
      if (cell.id) {
        cellsById[cell.id] = { residentName: cell.residentName, startTime: cell.startTime };
        rowsByCellId[cell.id] = { staffName: row.staffName };
      }
    });
  });

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

  // ── Template actions ──────────────────────────────────────────────────────
  const fromTemplateMut = useMutation({
    mutationFn: async () => {
      const r = await fetch(`/api/route-sheets/${dateStr}/from-template`, { method: "POST" });
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/route-sheets", dateStr] });
      toast({ title: "テンプレートから当日シートを生成しました" });
    },
    onError: () => toast({ title: "生成に失敗しました", variant: "destructive" }),
  });

  const saveAsTemplateMut = useMutation({
    mutationFn: async () => {
      const r = await fetch(`/api/route-sheets/${dateStr}/save-as-template`, { method: "POST" });
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
    onSuccess: () => toast({ title: `${DOW_JP[appDate.getDay()]}曜テンプレートとして保存しました` }),
    onError: () => toast({ title: "保存に失敗しました", variant: "destructive" }),
  });

  const resetMut = useMutation({
    mutationFn: async () => {
      const r = await fetch(`/api/route-sheets/${dateStr}`, { method: "DELETE" });
      if (!r.ok && r.status !== 404) throw new Error("Failed");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/route-sheets", dateStr] });
      setLocalSheet(null);
      setDirty(false);
      toast({ title: "テンプレートに戻しました" });
    },
    onError: () => toast({ title: "リセットに失敗しました", variant: "destructive" }),
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
  function saveCell(srcRowIdx: number, ci: number | null, cell: SheetCell, newStaffId: number | null | undefined) {
    const srcRow = sheet.rows[srcRowIdx];
    const currentStaffId = (srcRow?.staffId ?? null) as number | null;
    // undefined means "do not change staff" (template mode)
    const targetStaffId: number | null = newStaffId === undefined ? currentStaffId : newStaffId;

    let rows: SheetRow[] = sheet.rows;
    let dstRowIdx = srcRowIdx;

    if (targetStaffId !== currentStaffId) {
      // Locate destination row by staffId
      let foundIdx = -1;
      if (targetStaffId === null) {
        // Prefer an existing unassigned row that isn't the source
        foundIdx = rows.findIndex((r, i) => i !== srcRowIdx && (r.staffId ?? null) === null);
      } else {
        foundIdx = rows.findIndex((r) => r.staffId === targetStaffId);
      }
      if (foundIdx === -1) {
        // Create a new row for the target staff
        const staffMatch = targetStaffId !== null
          ? (allStaff as any[]).find((x) => x.id === targetStaffId)
          : null;
        const shiftMatch = targetStaffId !== null
          ? (shiftsToday as any[]).find((x) => x.staffId === targetStaffId)
          : null;
        const shiftTypeMatch = shiftMatch
          ? (allShiftTypes as any[]).find((x) => x.id === shiftMatch.shiftTypeId)
          : null;
        const newRow: SheetRow = {
          staffName: staffMatch ? `${staffMatch.lastName} ${staffMatch.firstName}` : "",
          shiftType: shiftTypeMatch?.code ?? "日",
          sortOrder: rows.length,
          staffId: targetStaffId,
          cells: [],
        };
        rows = [...rows, newRow];
        foundIdx = rows.length - 1;
      }
      dstRowIdx = foundIdx;
    }

    const finalRows = rows.map((r, i) => {
      if (i === srcRowIdx && i === dstRowIdx) {
        let cells = [...r.cells];
        if (ci === null) cells = [...cells, cell];
        else cells[ci] = cell;
        cells.sort((a, b) => timeToMin(a.startTime) - timeToMin(b.startTime));
        return { ...r, cells };
      }
      if (i === srcRowIdx) {
        if (ci === null) return r;
        return { ...r, cells: r.cells.filter((_, j) => j !== ci) };
      }
      if (i === dstRowIdx) {
        const cells = [...r.cells, cell].sort((a, b) => timeToMin(a.startTime) - timeToMin(b.startTime));
        return { ...r, cells };
      }
      return r;
    });
    mark({ ...sheet, rows: finalRows });
  }
  function deleteCell(ri: number, ci: number) {
    const rows = sheet.rows.map((r, i) =>
      i !== ri ? r : { ...r, cells: r.cells.filter((_, j) => j !== ci) }
    );
    mark({ ...sheet, rows });
  }

  // ── Move placed cell (used by drag-move and tap-move) ────────────────────
  function performMove(srcRowIdx: number, srcCellIdx: number, dstRowIdx: number, slotIndex: number, duplicate: boolean) {
    if (isTemplateView) {
      window.alert("テンプレート表示中は移動できません。先に『この日を編集する』ボタンを押してください。");
      return;
    }
    const srcCell = sheet.rows[srcRowIdx]?.cells[srcCellIdx];
    if (!srcCell) return;
    const dur = durationOf(srcCell);
    const startMin = GRID_START + slotIndex * SLOT_MIN;
    const endMin = Math.min(GRID_END, startMin + dur);
    const newCell: SheetCell = {
      ...srcCell,
      // Duplicates get a fresh id (undefined → server creates new row)
      id: duplicate ? undefined : srcCell.id,
      startTime: minToTime(startMin),
      endTime: minToTime(endMin),
    };
    const rows = sheet.rows.map((r, ri) => {
      let cells = r.cells;
      // Remove source unless duplicate
      if (!duplicate && ri === srcRowIdx) {
        cells = cells.filter((_, ci) => ci !== srcCellIdx);
      }
      // Add to target row
      if (ri === dstRowIdx) {
        cells = [...cells, newCell].sort((a, b) => timeToMin(a.startTime) - timeToMin(b.startTime));
      }
      return cells === r.cells ? r : { ...r, cells };
    });
    mark({ ...sheet, rows });
  }

  // ── DnD handlers ─────────────────────────────────────────────────────────
  const sensors = useSensors(
    // Pointer: small distance constraint so cell click still opens the modal,
    // and touch users can long-press without accidentally dragging.
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor),
  );

  // Track Ctrl/Meta during drag so the user can press the modifier mid-drag.
  useEffect(() => {
    if (!dragState) return;
    const sync = (e: KeyboardEvent | MouseEvent) => {
      const dup = (e as any).ctrlKey || (e as any).metaKey;
      setDragState((s) => (s && s.duplicate !== dup ? { ...s, duplicate: dup } : s));
    };
    window.addEventListener("keydown", sync as any);
    window.addEventListener("keyup", sync as any);
    window.addEventListener("mousemove", sync as any);
    return () => {
      window.removeEventListener("keydown", sync as any);
      window.removeEventListener("keyup", sync as any);
      window.removeEventListener("mousemove", sync as any);
    };
  }, [dragState?.payload]);

  function handleDragStart(event: DragStartEvent) {
    const payload = event.active.data.current as DragPayload | undefined;
    if (!payload) return;
    // Clear any pending single-click timeout so the edit modal doesn't pop up after a drag.
    if (pendingClickTimer.current) {
      clearTimeout(pendingClickTimer.current);
      pendingClickTimer.current = null;
      lastClickRef.current = null;
    }
    const ae = event.activatorEvent as any;
    const duplicate = !!(ae && (ae.ctrlKey || ae.metaKey));
    const ghostW = (dragDurationMin(payload) / SLOT_MIN) * SLOT_W;
    const ghostH = ROW_H - 4;
    const cursorX = ae?.clientX ?? 0;
    const cursorY = ae?.clientY ?? 0;
    setDragState({
      payload, duplicate, ghostW, ghostH, cursorX, cursorY,
      overRowIdx: null, overSlotIndex: null, colliding: false,
    });
    setMoveMode(null);
  }

  function handleDragMove(event: DragMoveEvent) {
    if (!dragState) return;
    // Track cursor position in viewport for fixed-position ghost rendering.
    const ae = event.activatorEvent as any;
    const cursorX = (ae?.clientX ?? 0) + event.delta.x;
    const cursorY = (ae?.clientY ?? 0) + event.delta.y;
    const overId = event.over?.id;
    if (!overId || typeof overId !== "string" || !overId.startsWith("row:")) {
      setDragState({ ...dragState, cursorX, cursorY, overRowIdx: null, overSlotIndex: null, colliding: false });
      return;
    }
    const rowIdx = parseInt(overId.slice(4));
    const rowEl = rowRefs.current.get(rowIdx);
    if (!rowEl) {
      setDragState({ ...dragState, cursorX, cursorY });
      return;
    }
    const rect = rowEl.getBoundingClientRect();
    // Ghost is rendered centered on the cursor, so its visual left edge is
    // cursorX - ghostW/2. Snap the slot to that edge (relative to row).
    const ghostLeft = cursorX - dragState.ghostW / 2 - rect.left;
    const slotIndex = snapSlotIndex(ghostLeft / SLOT_W);
    const dur = dragDurationMin(dragState.payload);
    const startMin = GRID_START + slotIndex * SLOT_MIN;
    const endMin = Math.min(GRID_END, startMin + dur);
    const excludeRow = dragState.payload.kind === "placed" && !dragState.duplicate ? dragState.payload.rowIdx : undefined;
    const excludeCell = dragState.payload.kind === "placed" && !dragState.duplicate ? dragState.payload.cellIdx : undefined;
    const colliding = detectCollision(sheet.rows, rowIdx, startMin, endMin, excludeRow, excludeCell);
    setDragState({ ...dragState, cursorX, cursorY, overRowIdx: rowIdx, overSlotIndex: slotIndex, colliding });
  }

  function handleDragEnd(event: DragEndEvent) {
    const ds = dragState;
    setDragState(null);
    if (!ds) return;
    const overId = event.over?.id;
    if (!overId || typeof overId !== "string" || !overId.startsWith("row:")) return;
    const dstRowIdx = parseInt(overId.slice(4));
    const slotIndex = ds.overSlotIndex ?? 0;

    if (ds.payload.kind === "palette") {
      const card = ds.payload.card;
      const startMin = GRID_START + slotIndex * SLOT_MIN;
      const endMin = Math.min(GRID_END, startMin + card.durationMin);
      setCellModal({
        rowIndex: dstRowIdx,
        cellIndex: null,
        cell: {
          startTime: minToTime(startMin),
          endTime: minToTime(endMin),
          isBreak: card.isBreak,
          residentName: card.isBreak ? "" : (selectedResident?.name ?? ""),
          serviceLabel: card.fullLabel,
          residentId: card.isBreak ? null : (selectedResident?.id ?? null),
        },
      });
    } else {
      // placed-cell: move or duplicate
      if (isTemplateView) return;
      performMove(ds.payload.rowIdx, ds.payload.cellIdx, dstRowIdx, slotIndex, ds.duplicate);
    }
  }

  function handleDragCancel() {
    setDragState(null);
  }

  // ── Tap / move-mode handlers ─────────────────────────────────────────────
  const lastClickRef = useRef<{ key: string; t: number } | null>(null);
  const pendingClickTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const DOUBLE_TAP_MS = 350;

  function cancelPendingClick() {
    if (pendingClickTimer.current) {
      clearTimeout(pendingClickTimer.current);
      pendingClickTimer.current = null;
    }
    lastClickRef.current = null;
  }

  function handleCellClick(rowIdx: number, cellIdx: number) {
    if (isTemplateView) {
      // template view: just open editor (no double-tap-to-move while in template view)
      openEditCell(rowIdx, cellIdx);
      return;
    }
    const key = `${rowIdx}:${cellIdx}`;
    const now = Date.now();
    const last = lastClickRef.current;
    if (last && last.key === key && now - last.t < DOUBLE_TAP_MS) {
      // Double tap → enter move mode
      cancelPendingClick();
      setMoveMode({ rowIdx, cellIdx });
      return;
    }
    cancelPendingClick();
    lastClickRef.current = { key, t: now };
    pendingClickTimer.current = setTimeout(() => {
      pendingClickTimer.current = null;
      if (lastClickRef.current?.key === key && lastClickRef.current.t === now) {
        lastClickRef.current = null;
        openEditCell(rowIdx, cellIdx);
      }
    }, DOUBLE_TAP_MS);
  }

  function handleTrackClick(rowIdx: number, slotIndex: number, _evt: React.MouseEvent) {
    if (!moveMode) return;
    const duplicate = false;
    performMove(moveMode.rowIdx, moveMode.cellIdx, rowIdx, slotIndex, duplicate);
    setMoveMode(null);
  }

  // ESC cancels move mode
  useEffect(() => {
    if (!moveMode) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMoveMode(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [moveMode]);

  // Ghost preview helpers (for DragOverlay)
  const ghost = useMemo(() => {
    if (!dragState || dragState.overRowIdx === null || dragState.overSlotIndex === null) return null;
    const dur = dragDurationMin(dragState.payload);
    const startMin = GRID_START + dragState.overSlotIndex * SLOT_MIN;
    const endMin = Math.min(GRID_END, startMin + dur);
    const startTime = minToTime(startMin);
    const endTime = minToTime(endMin);
    const label = dragState.payload.kind === "palette"
      ? dragState.payload.card.fullLabel
      : (dragState.payload.cell.serviceLabel ?? "");
    const name = dragState.payload.kind === "palette"
      ? (selectedResident?.name ?? "—")
      : (dragState.payload.cell.residentName ?? "—");
    return {
      width: (dur / SLOT_MIN) * SLOT_W,
      startTime, endTime, label, name,
      colliding: dragState.colliding,
      duplicate: dragState.duplicate,
    };
  }, [dragState, selectedResident]);

  const eraYear = appDate.getFullYear() - 2018;

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragMove={handleDragMove}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
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

          {/* ── Template source banner ── */}
          {!isLoading && source === "template" && (
            <div className="bg-blue-50 border-l-4 border-blue-500 rounded-lg p-3 flex items-center justify-between gap-3 flex-wrap">
              <span className="text-sm text-blue-800">
                📋 テンプレート表示中（{DOW_JP[appDate.getDay()]}曜テンプレ）— 編集すると当日シートが作成されます
              </span>
              <Button
                size="sm"
                onClick={() => fromTemplateMut.mutate()}
                disabled={fromTemplateMut.isPending}
                className="shrink-0"
              >
                {fromTemplateMut.isPending ? "生成中..." : "この日を編集する"}
              </Button>
            </div>
          )}

          {/* ── Instance action bar ── */}
          {!isLoading && source === "instance" && !dirty && (
            <div className="flex justify-end gap-2 flex-wrap">
              <Button
                variant="outline"
                size="sm"
                onClick={() => saveAsTemplateMut.mutate()}
                disabled={saveAsTemplateMut.isPending}
              >
                {DOW_JP[appDate.getDay()]}曜テンプレとして保存
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  if (window.confirm("当日シートを削除してテンプレートに戻しますか？")) resetMut.mutate();
                }}
                disabled={resetMut.isPending}
              >
                テンプレに戻す
              </Button>
            </div>
          )}

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
          <div className="bg-white rounded-xl border border-gray-200 p-3 space-y-3">
            <div>
              <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5">
                ① 訪問先の利用者を選択
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <div className="relative">
                  <UserRound className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400 pointer-events-none" />
                  <select
                    value={selectedResident?.id.toString() ?? ""}
                    onChange={(e) => {
                      if (!e.target.value) { setSelectedResident(null); return; }
                      const id = parseInt(e.target.value);
                      const r = residents.find((x) => x.id === id);
                      if (r) setSelectedResident({ id: r.id, name: r.name });
                    }}
                    className="h-9 pl-8 pr-3 text-sm border border-input rounded-md bg-background appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/30 min-w-[160px]"
                  >
                    <option value="">利用者を選択...</option>
                    {residents.map((r) => (
                      <option key={r.id} value={r.id}>{r.name}</option>
                    ))}
                  </select>
                </div>
                {selectedResident && (
                  <div className="flex items-center gap-1.5 bg-primary/10 text-primary border border-primary/20 rounded-full px-3 py-1">
                    <span className="text-xs font-bold">{selectedResident.name}様</span>
                    <button
                      onClick={() => setSelectedResident(null)}
                      className="text-primary/60 hover:text-primary ml-0.5"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div>
              <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5">
                ② サービスカードをドラッグしてスタッフ行へ配置
                <span className="ml-1.5 text-gray-400 normal-case">
                  ／ 配置済みコマはドラッグで移動、Cmd/Ctrl+ドラッグで複製、ダブルクリックでタップ移動
                </span>
                {!selectedResident && (
                  <span className="ml-1.5 text-amber-500 normal-case">（利用者を先に選択するとスムーズです）</span>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {SERVICE_CARDS.map((card) => (
                  <PaletteCard key={card.id} card={card} hasResident={!!selectedResident} />
                ))}
              </div>
            </div>
          </div>

          {/* ── Conflict banner ── */}
          <ConflictBanner conflicts={conflicts} cellsById={cellsById} rowsByCellId={rowsByCellId} />

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
                        <div className="relative" style={{ height: 20, width: TOTAL_W }}>
                          {/* Same color bands as gantt rows, so header and body align visually */}
                          <HourBands />
                          <GridLines />
                          {HOURS.map((h) => {
                            const left = (h * 60 - GRID_START) / SLOT_MIN * SLOT_W;
                            return (
                              <div
                                key={h}
                                style={{ left }}
                                className="absolute top-0 bottom-0 flex items-center z-10"
                              >
                                <span className="text-[10px] text-gray-700 font-mono font-bold pl-0.5">
                                  {h}:00
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {sheet.rows.map((row, ri) => {
                      const isOver = dragState?.overRowIdx === ri;
                      return (
                        <tr
                          key={ri}
                          className={`border-b border-gray-100 transition-colors ${isOver ? "bg-primary/5" : ""}`}
                        >
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

                          <td
                            className="sticky z-20 bg-white border-r border-gray-200 px-1 text-center"
                            style={{ left: NAME_W, width: SHIFT_W, minWidth: SHIFT_W }}
                          >
                            <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded ${shiftBg(row.shiftType)}`}>
                              {row.shiftType}
                            </span>
                          </td>

                          <td className="p-0" style={{ width: TOTAL_W }}>
                            <RowTimeline
                              rowIdx={ri}
                              isDragActive={!!dragState}
                              isOver={isOver}
                              dropIndicator={
                                isOver && dragState && dragState.overSlotIndex !== null
                                  ? {
                                      slotIndex: dragState.overSlotIndex,
                                      widthPx: (dragDurationMin(dragState.payload) / SLOT_MIN) * SLOT_W,
                                      colliding: dragState.colliding,
                                    }
                                  : null
                              }
                              registerRef={registerRowRef}
                              onTrackClick={handleTrackClick}
                            >
                              {row.cells.map((cell, ci) => (
                                <DraggableCell
                                  key={ci}
                                  cell={cell}
                                  rowIdx={ri}
                                  cellIdx={ci}
                                  onClick={() => handleCellClick(ri, ci)}
                                  isConflict={cell.id !== undefined && conflictCellIds.has(cell.id)}
                                  isMoveTarget={moveMode?.rowIdx === ri && moveMode?.cellIdx === ci}
                                />
                              ))}
                            </RowTimeline>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* ── Day service + special notes ── */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
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

        {/* ── Move-mode guide banner ── */}
        {moveMode && (
          <div
            role="status"
            aria-live="polite"
            className="fixed top-16 left-1/2 -translate-x-1/2 bg-blue-600 text-white px-4 py-2 rounded shadow-lg z-50 flex items-center gap-3 text-sm"
          >
            <span>移動先のスタッフ行・時刻をタップしてください</span>
            <button
              onClick={() => setMoveMode(null)}
              className="underline text-xs hover:opacity-80"
            >
              中止（ESC）
            </button>
          </div>
        )}

        {/* ── Modal ── */}
        {cellModal && (
          <CellModal
            state={cellModal}
            residents={residents}
            staffOptions={staffOptions}
            currentStaffId={(sheet.rows[cellModal.rowIndex]?.staffId ?? null) as number | null}
            isTemplateView={isTemplateView}
            onSave={saveCell}
            onDelete={deleteCell}
            onClose={() => setCellModal(null)}
          />
        )}
      </Layout>

      {/* ── Drag Overlay (empty — ghost is rendered as fixed div below) ── */}
      <DragOverlay dropAnimation={null}>{null}</DragOverlay>

      {/* ── Cursor-following Ghost (fixed position, pattern B) ── */}
      {ghost && dragState && (
        <div
          className={`fixed pointer-events-none z-50 rounded border-2 border-dashed px-1 py-0.5 flex flex-col justify-center shadow-lg ${
            ghost.colliding
              ? "bg-red-400/70 border-red-600 text-red-900"
              : "bg-blue-400/70 border-blue-700 text-blue-900"
          }`}
          style={{
            width: ghost.width,
            height: dragState.ghostH,
            left: dragState.cursorX - ghost.width / 2,
            top: dragState.cursorY - dragState.ghostH / 2,
          }}
        >
            <div className="flex items-center gap-1 text-[10px] font-bold leading-tight">
              {ghost.colliding && <AlertTriangle className="h-3 w-3 shrink-0" />}
              <span className="truncate">{ghost.name}</span>
              {ghost.duplicate && <span className="ml-1 text-[9px] bg-white/40 px-1 rounded">複製</span>}
            </div>
            <div className="text-[9px] leading-tight opacity-80 truncate whitespace-pre-line">
              {ghost.label}
            </div>
            <div className="text-[9px] leading-tight font-mono opacity-80">
              {ghost.startTime}–{ghost.endTime}
            </div>
            {ghost.colliding && (
              <div className="text-[9px] font-bold">⚠️ 既存と重複</div>
            )}
        </div>
      )}
    </DndContext>
  );
}
