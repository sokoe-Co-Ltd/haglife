import { AlertTriangle } from "lucide-react";

interface VisitConflictItem {
  cellAId: number;
  cellBId: number;
  staffId?: number | null;
  aStart: string;
  aEnd: string;
  bStart: string;
  bEnd: string;
}

interface Props {
  conflicts: VisitConflictItem[];
  cellsById: Record<number, { residentName?: string | null; startTime: string }>;
  rowsByCellId: Record<number, { staffName?: string | null }>;
}

export function ConflictBanner({ conflicts, cellsById, rowsByCellId }: Props) {
  if (conflicts.length === 0) return null;

  return (
    <div className="bg-amber-50 border-l-4 border-amber-500 rounded-r-lg p-3 mb-3">
      <div className="flex items-start gap-2">
        <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-amber-900">
            スケジュール競合 {conflicts.length} 件
          </p>
          <ul className="mt-1 space-y-0.5">
            {conflicts.slice(0, 5).map((c) => {
              const a = cellsById[c.cellAId];
              const b = cellsById[c.cellBId];
              const staff = rowsByCellId[c.cellAId]?.staffName || "(未割当)";
              return (
                <li key={`${c.cellAId}-${c.cellBId}`} className="text-xs text-amber-800">
                  <strong>{staff}</strong>: {a?.residentName ?? "?"} ({c.aStart.slice(0, 5)}) と{" "}
                  {b?.residentName ?? "?"} ({c.bStart.slice(0, 5)}) が時間重複
                </li>
              );
            })}
            {conflicts.length > 5 && (
              <li className="text-xs text-amber-600">…他 {conflicts.length - 5} 件</li>
            )}
          </ul>
        </div>
      </div>
    </div>
  );
}
