import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { Bell, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AuditCellView } from "@workspace/api-client-react";
import { timeToPercent, hourTicks, GANTT_START_MIN, GANTT_END_MIN } from "../utils/time";
import { isReasonEmpty, displaySkipReason } from "../utils/skipReason";
import { AuditCellModal } from "./AuditCellModal";
import type { AuditAxis } from "./AxisTabs";

type GroupRow = {
  key: string;
  label: string;
  shiftType?: string | null;
  shiftTypeColor?: string | null;
  cells: AuditCellView[];
  phantomReassigned: AuditCellView[];
};

function groupCells(cells: AuditCellView[], axis: AuditAxis): GroupRow[] {
  const groups = new Map<string, GroupRow>();

  const ensure = (key: string, label: string, shiftType?: string | null, color?: string | null) => {
    if (!groups.has(key)) {
      groups.set(key, {
        key,
        label,
        shiftType: shiftType ?? null,
        shiftTypeColor: color ?? null,
        cells: [],
        phantomReassigned: [],
      });
    }
    return groups.get(key)!;
  };

  for (const c of cells) {
    if (axis === "staff") {
      const ownerStaffId = c.actualStaffId ?? c.plannedStaffId;
      const ownerName = c.actualStaffName ?? c.plannedStaffName ?? "未割当";
      if (ownerStaffId != null) {
        const g = ensure(`s:${ownerStaffId}`, ownerName, c.rowShiftType, c.rowShiftTypeColor);
        g.cells.push(c);
      } else {
        const g = ensure("s:none", "未割当", null, null);
        g.cells.push(c);
      }
      if (c.staffReassigned && c.plannedStaffId != null && c.plannedStaffId !== c.actualStaffId) {
        const g = ensure(
          `s:${c.plannedStaffId}`,
          c.plannedStaffName ?? "—",
          c.rowShiftType,
          c.rowShiftTypeColor,
        );
        g.phantomReassigned.push(c);
      }
    } else {
      const key = c.residentId != null ? `r:${c.residentId}` : "r:none";
      const label = c.residentName ?? "—";
      const g = ensure(key, label);
      g.cells.push(c);
    }
  }

  return [...groups.values()].sort((a, b) => a.label.localeCompare(b.label, "ja"));
}

export function AuditGantt({
  cells,
  date,
  axis,
}: {
  cells: AuditCellView[];
  date: string;
  axis: AuditAxis;
}) {
  const groups = useMemo(() => groupCells(cells, axis), [cells, axis]);
  const [openCell, setOpenCell] = useState<AuditCellView | null>(null);
  const ticks = hourTicks();
  const totalHours = (GANTT_END_MIN - GANTT_START_MIN) / 60;

  return (
    <div className="border rounded-lg overflow-hidden bg-background">
      {/* Time header */}
      <div className="flex border-b bg-muted/30">
        <div className="w-40 shrink-0 border-r px-3 py-2 text-xs text-muted-foreground">
          {axis === "staff" ? "ヘルパー" : "利用者"}
        </div>
        <div className="flex-1 relative h-8">
          {ticks.map((h) => {
            const pct = ((h - GANTT_START_MIN / 60) / totalHours) * 100;
            return (
              <div
                key={h}
                className="absolute top-0 bottom-0 text-[10px] text-muted-foreground -translate-x-1/2 pt-1"
                style={{ left: `${pct}%` }}
              >
                {h}:00
              </div>
            );
          })}
        </div>
      </div>

      {/* Rows */}
      {groups.length === 0 ? (
        <div className="p-6 text-center text-sm text-muted-foreground">
          この日のデータはありません
        </div>
      ) : (
        groups.map((g) => (
          <div key={g.key} className="flex border-b last:border-b-0 min-h-[60px]">
            <div className="w-40 shrink-0 border-r px-3 py-2 flex items-start gap-2">
              {axis === "staff" && g.shiftTypeColor && (
                <span
                  className="w-1 self-stretch rounded-sm"
                  style={{ backgroundColor: g.shiftTypeColor }}
                />
              )}
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{g.label}</div>
                {axis === "staff" && g.shiftType && (
                  <div className="text-[10px] text-muted-foreground mt-0.5">{g.shiftType}</div>
                )}
              </div>
            </div>
            <div className="flex-1 relative py-1.5">
              {ticks.map((h) => {
                const pct = ((h - GANTT_START_MIN / 60) / totalHours) * 100;
                return (
                  <div
                    key={h}
                    className="absolute top-0 bottom-0 border-l border-border/30"
                    style={{ left: `${pct}%` }}
                  />
                );
              })}
              {g.phantomReassigned.map((c) => (
                <PhantomReassignSlot key={`p-${c.id}`} cell={c} />
              ))}
              {g.cells.map((c) => (
                <CellBar
                  key={c.id}
                  cell={c}
                  axis={axis}
                  onOpen={() => setOpenCell(c)}
                />
              ))}
            </div>
          </div>
        ))
      )}

      {openCell && (
        <AuditCellModal
          cell={openCell}
          date={date}
          open={!!openCell}
          onClose={() => setOpenCell(null)}
        />
      )}
    </div>
  );
}

function CellBar({
  cell,
  axis,
  onOpen,
}: {
  cell: AuditCellView;
  axis: AuditAxis;
  onOpen: () => void;
}) {
  const start = cell.startTime ?? cell.plannedStartTime ?? "";
  const end = cell.endTime ?? cell.plannedEndTime ?? "";
  const left = timeToPercent(start);
  const right = timeToPercent(end);
  const width = Math.max(2, right - left);
  const noReason = cell.status === "skipped" && isReasonEmpty(cell.skipReason);

  const primaryLabel =
    axis === "staff"
      ? cell.residentName ?? "—"
      : cell.actualStaffName ?? cell.plannedStaffName ?? "—";

  return (
    <button
      onClick={onOpen}
      className={cn(
        "absolute top-1 bottom-1 rounded-md p-1.5 text-left text-xs",
        "hover:ring-2 hover:ring-foreground/20 transition flex flex-col justify-center overflow-hidden",
        getCellColor(cell),
      )}
      style={{ left: `${left}%`, width: `${width}%` }}
      title={`${start}-${end} ${primaryLabel}`}
    >
      <span className={cn("font-medium truncate", cell.status === "skipped" && "line-through")}>
        {primaryLabel}
      </span>
      <span className="text-[10px] opacity-80 truncate">
        {cell.serviceLabel ?? cell.plannedServiceLabel}
        {cell.status === "skipped" && ` ・ ${displaySkipReason(cell.skipReason)}`}
        {cell.status === "added" && " ・追加"}
        {cell.staffReassigned && " ・代替"}
      </span>
      {cell.modifiedNote && (
        <span className="absolute top-1 right-1 size-1.5 rounded-full bg-amber-500" />
      )}
      {cell.isAdHoc && (
        <Bell className="absolute top-1 right-1 size-2.5 text-purple-700" />
      )}
      {noReason && (
        <AlertTriangle className="absolute top-1 right-1 size-2.5 text-orange-600" />
      )}
    </button>
  );
}

function PhantomReassignSlot({ cell }: { cell: AuditCellView }) {
  const [, navigate] = useLocation();
  const left = timeToPercent(cell.plannedStartTime);
  const right = timeToPercent(cell.plannedEndTime);
  const width = Math.max(2, right - left);
  return (
    <button
      className={cn(
        "absolute top-1.5 bottom-1.5 rounded-md p-1.5 text-xs",
        "bg-stripe-pattern border border-dashed border-muted-foreground/40",
        "text-muted-foreground hover:ring-2 hover:ring-foreground/20 transition",
        "flex flex-col justify-center overflow-hidden",
      )}
      style={{ left: `${left}%`, width: `${width}%` }}
      onClick={() => navigate(`/admin/audit/cells/${cell.id}`)}
      title={`→ ${cell.actualStaffName ?? "—"} に振替`}
    >
      <span className="line-through truncate">{cell.residentName ?? "—"}</span>
      <span className="text-[10px] block truncate">→{cell.actualStaffName ?? "—"}</span>
    </button>
  );
}

function getCellColor(cell: AuditCellView): string {
  if (cell.status === "skipped") {
    return "bg-red-50 border border-red-500/60 text-red-900";
  }
  if (cell.isAdHoc || cell.status === "added") {
    return "bg-purple-50 border border-purple-500/60 text-purple-900";
  }
  if (cell.staffReassigned) {
    return "bg-blue-50 border border-blue-500/60 text-blue-900";
  }
  return "bg-background border border-border/60";
}
