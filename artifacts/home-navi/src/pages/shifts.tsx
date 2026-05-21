import { useState } from "react";
import {
  useListShifts, useListShiftTypes, useListStaff, useBulkUpsertShifts, useDeleteShift,
  getListShiftsQueryKey,
} from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { useQueryClient } from "@tanstack/react-query";
import { format, startOfWeek, addDays, parseISO } from "date-fns";
import { ja } from "date-fns/locale";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

function toDateStr(d: Date) {
  return format(d, "yyyy-MM-dd");
}

export default function ShiftsPage() {
  const qc = useQueryClient();
  const [weekStart, setWeekStart] = useState<Date>(() => startOfWeek(new Date(), { weekStartsOn: 0 }));

  const weekDates = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const from = toDateStr(weekDates[0]);
  const to = toDateStr(weekDates[6]);

  const { data: shifts = [] } = useListShifts({ from, to });
  const { data: shiftTypes = [] } = useListShiftTypes();
  const { data: staffListAll = [] } = useListStaff();
  // 職員一覧で「非表示」にした職員はシフト管理にも出さない
  const staffList = (staffListAll as any[]).filter((s) => s.isVisible !== false);
  const bulkMut = useBulkUpsertShifts({
    mutation: { onSuccess: () => qc.invalidateQueries({ queryKey: getListShiftsQueryKey() }) },
  });
  const deleteMut = useDeleteShift({
    mutation: { onSuccess: () => qc.invalidateQueries({ queryKey: getListShiftsQueryKey() }) },
  });

  const prevWeek = () => setWeekStart(d => addDays(d, -7));
  const nextWeek = () => setWeekStart(d => addDays(d, 7));

  function getShift(staffId: number, date: string) {
    return (shifts as any[]).find((s) => s.staffId === staffId && s.date === date);
  }

  async function setShiftType(staffId: number, date: string, shiftTypeId: string) {
    const existing = getShift(staffId, date);
    if (shiftTypeId === "__clear__") {
      if (existing) await deleteMut.mutateAsync({ id: existing.id });
      return;
    }
    await bulkMut.mutateAsync({
      data: { shifts: [{ staffId, date, shiftTypeId, slotLabel: "" }] },
    });
  }

  const WEEKDAY_LABELS = ["日", "月", "火", "水", "木", "金", "土"];

  return (
    <Layout>
      <div className="space-y-4 max-w-5xl">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-800">シフト管理</h1>
            <p className="text-xs text-gray-500 mt-0.5">職員の週次シフトを設定します</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={prevWeek}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm font-medium text-gray-700 min-w-[160px] text-center">
              {format(weekDates[0], "yyyy年M月d日", { locale: ja })} 〜{" "}
              {format(weekDates[6], "M月d日", { locale: ja })}
            </span>
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={nextWeek}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-600 w-28 sticky left-0 bg-gray-50">
                  職員
                </th>
                {weekDates.map((d, i) => (
                  <th key={i} className={`px-2 py-2.5 text-center text-xs font-semibold min-w-[96px] ${
                    i === 0 ? "text-red-500" : i === 6 ? "text-blue-500" : "text-gray-600"
                  }`}>
                    <div>{WEEKDAY_LABELS[d.getDay()]}</div>
                    <div className="text-gray-400 font-normal">{format(d, "M/d")}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {(staffList as any[]).length === 0 && (
                <tr>
                  <td colSpan={8} className="text-center py-8 text-sm text-gray-400">職員がいません</td>
                </tr>
              )}
              {(staffList as any[]).map((staff) => (
                <tr key={staff.id} className="hover:bg-gray-50">
                  <td className="px-3 py-1.5 sticky left-0 bg-white text-sm font-medium whitespace-nowrap">
                    {staff.lastName} {staff.firstName}
                  </td>
                  {weekDates.map((d) => {
                    const dateStr = toDateStr(d);
                    const shift = getShift(staff.id, dateStr);
                    const currentTypeId = shift?.shiftTypeId ?? "__clear__";
                    return (
                      <td key={dateStr} className="px-1 py-1">
                        <Select
                          value={currentTypeId}
                          onValueChange={(v) => setShiftType(staff.id, dateStr, v)}
                        >
                          <SelectTrigger className="h-8 text-xs px-1.5 border-gray-200">
                            <SelectValue>
                              {shift ? (() => {
                                const st = (shiftTypes as any[]).find(t => t.id === shift.shiftTypeId);
                                return st ? (
                                  <span
                                    className="px-1.5 py-0.5 rounded text-xs font-bold"
                                    style={{ background: (st.color ?? "#888") + "22", color: st.color ?? "#555" }}
                                  >
                                    {st.code}
                                  </span>
                                ) : "—";
                              })() : <span className="text-gray-300">—</span>}
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__clear__">
                              <span className="text-gray-400">— (なし)</span>
                            </SelectItem>
                            {(shiftTypes as any[]).filter(t => t.isActive).map((st) => (
                              <SelectItem key={st.id} value={st.id}>
                                <span
                                  className="px-1.5 py-0.5 rounded text-xs font-bold mr-2"
                                  style={{ background: (st.color ?? "#888") + "22", color: st.color ?? "#555" }}
                                >
                                  {st.code}
                                </span>
                                {st.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </Layout>
  );
}
