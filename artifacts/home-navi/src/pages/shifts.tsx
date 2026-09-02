import { useRef, useState } from "react";
import {
  useListShifts, useListShiftTypes, useListStaff, useBulkUpsertShifts, useDeleteShift,
  getListShiftsQueryKey,
} from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { useQueryClient } from "@tanstack/react-query";
import { format, startOfWeek, addDays, parseISO } from "date-fns";
import { ja } from "date-fns/locale";
import {
  AlertCircle,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Loader2,
  MoveHorizontal,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

function toDateStr(d: Date) {
  return format(d, "yyyy-MM-dd");
}

export default function ShiftsPage() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [weekStart, setWeekStart] = useState<Date>(() => startOfWeek(new Date(), { weekStartsOn: 0 }));
  const [savingCell, setSavingCell] = useState<string | null>(null);
  const [savedCell, setSavedCell] = useState<string | null>(null);
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const weekDates = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const from = toDateStr(weekDates[0]);
  const to = toDateStr(weekDates[6]);

  const shiftsQuery = useListShifts({ from, to });
  const shiftTypesQuery = useListShiftTypes();
  const staffQuery = useListStaff();
  const shifts = shiftsQuery.data ?? [];
  const shiftTypes = shiftTypesQuery.data ?? [];
  const staffListAll = staffQuery.data ?? [];
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
  const goToThisWeek = () => setWeekStart(startOfWeek(new Date(), { weekStartsOn: 0 }));

  function getShift(staffId: number, date: string) {
    return (shifts as any[]).find((s) => s.staffId === staffId && s.date === date);
  }

  async function setShiftType(staffId: number, date: string, shiftTypeId: string) {
    const cellKey = `${staffId}-${date}`;
    setSavingCell(cellKey);
    setSavedCell(null);
    try {
      const existing = getShift(staffId, date);
      if (shiftTypeId === "__clear__") {
        if (existing) await deleteMut.mutateAsync({ id: existing.id });
      } else {
        await bulkMut.mutateAsync({
          data: { shifts: [{ staffId, date, shiftTypeId, slotLabel: "" }] },
        });
      }
      setSavedCell(cellKey);
      if (savedTimer.current) clearTimeout(savedTimer.current);
      savedTimer.current = setTimeout(() => setSavedCell(null), 1800);
    } catch {
      toast({
        title: "シフトを保存できませんでした",
        description: "通信状態を確認して、もう一度選択してください。",
        variant: "destructive",
      });
    } finally {
      setSavingCell(null);
    }
  }

  const WEEKDAY_LABELS = ["日", "月", "火", "水", "木", "金", "土"];
  const isLoading = shiftsQuery.isLoading || shiftTypesQuery.isLoading || staffQuery.isLoading;
  const hasError = shiftsQuery.isError || shiftTypesQuery.isError || staffQuery.isError;
  const isThisWeek = toDateStr(weekStart) === toDateStr(startOfWeek(new Date(), { weekStartsOn: 0 }));

  return (
    <Layout>
      <div className="space-y-4 max-w-6xl">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-800">シフト管理</h1>
            <p className="text-xs text-gray-500 mt-0.5">職員の週次シフトを設定します</p>
          </div>
          <div className="flex items-center justify-between gap-1.5 sm:justify-end">
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={prevWeek}>
              <ChevronLeft className="h-4 w-4" />
              <span className="sr-only">前の週</span>
            </Button>
            <span className="text-sm font-medium text-gray-700 min-w-[150px] sm:min-w-[170px] text-center">
              {format(weekDates[0], "yyyy年M月d日", { locale: ja })} 〜{" "}
              {format(weekDates[6], "M月d日", { locale: ja })}
            </span>
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={nextWeek}>
              <ChevronRight className="h-4 w-4" />
              <span className="sr-only">次の週</span>
            </Button>
            <Button
              variant={isThisWeek ? "secondary" : "outline"}
              size="sm"
              className="h-8 px-2.5 ml-1"
              onClick={goToThisWeek}
              disabled={isThisWeek}
            >
              <CalendarDays className="h-3.5 w-3.5 mr-1" />
              今週
            </Button>
          </div>
        </div>

        <div className="md:hidden flex items-center gap-2 rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-700">
          <MoveHorizontal className="h-4 w-4 shrink-0" />
          表を横にスワイプすると、ほかの曜日を確認できます
        </div>

        {hasError ? (
          <div className="bg-white rounded-xl border border-red-200 py-12 px-4 text-center">
            <AlertCircle className="h-8 w-8 text-red-400 mx-auto mb-2" />
            <p className="font-semibold text-gray-700">シフト表を読み込めませんでした</p>
            <p className="text-xs text-gray-500 mt-1">通信状態を確認してページを再読み込みしてください。</p>
          </div>
        ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-auto max-h-[calc(100vh-180px)] relative">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-20">
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-600 min-w-28 sticky left-0 top-0 z-30 bg-gray-50 shadow-[2px_0_0_0_#e5e7eb]">
                  職員
                </th>
                {weekDates.map((d, i) => (
                  <th key={i} className={`px-2 py-2.5 text-center text-xs font-semibold min-w-[112px] bg-gray-50 ${
                    i === 0 ? "text-red-500" : i === 6 ? "text-blue-500" : "text-gray-600"
                  }`}>
                    <div>{WEEKDAY_LABELS[d.getDay()]}</div>
                    <div className="text-gray-400 font-normal">{format(d, "M/d")}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading && (
                <tr>
                  <td colSpan={8} className="text-center py-14 text-sm text-gray-500">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2 text-primary" />
                    シフト表を読み込んでいます
                  </td>
                </tr>
              )}
              {!isLoading && (shiftTypes as any[]).filter(t => t.isActive).length === 0 && (
                <tr>
                  <td colSpan={8} className="text-center py-10 text-sm text-gray-500">
                    <p className="font-semibold text-gray-700">シフト種別が登録されていません</p>
                    <p className="text-xs mt-1">サイドメニューの「シフト種別」から勤務区分を登録してください。</p>
                  </td>
                </tr>
              )}
              {!isLoading && (shiftTypes as any[]).filter(t => t.isActive).length > 0 && (staffList as any[]).length === 0 && (
                <tr>
                  <td colSpan={8} className="text-center py-10 text-sm text-gray-500">
                    <p className="font-semibold text-gray-700">表示できる職員がいません</p>
                    <p className="text-xs mt-1">職員一覧で職員を登録するか、表示設定を確認してください。</p>
                  </td>
                </tr>
              )}
              {!isLoading && (shiftTypes as any[]).filter(t => t.isActive).length > 0 && (staffList as any[]).map((staff) => (
                <tr key={staff.id} className="hover:bg-gray-50">
                  <td className="px-3 py-1.5 sticky left-0 z-10 bg-white text-sm font-medium whitespace-nowrap shadow-[2px_0_0_0_#f3f4f6]">
                    {staff.lastName} {staff.firstName}
                  </td>
                  {weekDates.map((d) => {
                    const dateStr = toDateStr(d);
                    const shift = getShift(staff.id, dateStr);
                    const currentTypeId = shift?.shiftTypeId ?? "__clear__";
                    const cellKey = `${staff.id}-${dateStr}`;
                    const selectedType = (shiftTypes as any[]).find(t => t.id === shift?.shiftTypeId);
                    return (
                      <td key={dateStr} className="px-1 py-1 relative">
                        <Select
                          value={currentTypeId}
                          onValueChange={(v) => setShiftType(staff.id, dateStr, v)}
                          disabled={savingCell === cellKey}
                        >
                          <SelectTrigger
                            className={`h-10 text-xs px-1.5 border-gray-200 ${
                              savingCell === cellKey ? "bg-amber-50 border-amber-200" :
                              savedCell === cellKey ? "bg-green-50 border-green-200" : ""
                            }`}
                            title={selectedType
                              ? `${selectedType.name} ${selectedType.defaultStartTime ?? ""}〜${selectedType.defaultEndTime ?? ""}`
                              : "シフトを選択"}
                          >
                            <SelectValue>
                              {savingCell === cellKey ? (
                                <span className="flex items-center gap-1 text-amber-700">
                                  <Loader2 className="h-3 w-3 animate-spin" /> 保存中
                                </span>
                              ) : selectedType ? (
                                <span className="flex flex-col items-start leading-tight min-w-0">
                                  <span
                                    className="px-1.5 py-0.5 rounded text-xs font-bold"
                                    style={{ background: (selectedType.color ?? "#888") + "22", color: selectedType.color ?? "#555" }}
                                  >
                                    {selectedType.code}
                                  </span>
                                  {(selectedType.defaultStartTime || selectedType.defaultEndTime) && (
                                    <span className="text-[10px] text-gray-500 mt-0.5 truncate">
                                      {selectedType.defaultStartTime ?? "?"}–{selectedType.defaultEndTime ?? "?"}
                                    </span>
                                  )}
                                </span>
                              ) : <span className="text-gray-300">—</span>}
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
                        {savedCell === cellKey && (
                          <CheckCircle2 className="absolute right-0.5 top-0.5 h-3 w-3 text-green-600 bg-white rounded-full" />
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        )}
      </div>
    </Layout>
  );
}
