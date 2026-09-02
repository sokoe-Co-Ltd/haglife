import { useRef, useState } from "react";
import { useListShifts, useListShiftTypes, useListStaff, useBulkUpsertShifts, useDeleteShift, getListShiftsQueryKey } from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { useQueryClient } from "@tanstack/react-query";
import { format, startOfWeek, addDays, parseISO } from "date-fns";
import { ja } from "date-fns/locale";
import { AlertCircle, CalendarDays, CheckCircle2, CheckSquare2, ChevronLeft, ChevronRight, Copy, Eraser, Loader2, MousePointer2, MoveHorizontal } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

function toDateStr(d: Date) {
  return format(d, "yyyy-MM-dd");
}

export default function ShiftsPage() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [weekStart, setWeekStart] = useState<Date>(() => startOfWeek(new Date(), { weekStartsOn: 0 }));
  const [savingCell, setSavingCell] = useState<string | null>(null);
  const [savedCell, setSavedCell] = useState<string | null>(null);
  const [bulkMode, setBulkMode] = useState(false);
  const [selectedCells, setSelectedCells] = useState<Set<string>>(new Set());
  const [bulkShiftTypeId, setBulkShiftTypeId] = useState<string>("");
  const [paintShiftTypeId, setPaintShiftTypeId] = useState<string | null>(null);
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const weekDates = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const from = toDateStr(weekDates[0]);
  const to = toDateStr(weekDates[6]);

  const shiftsQuery = useListShifts({ from, to });
  const previousWeekDates = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i - 7));
  const previousShiftsQuery = useListShifts({
    from: toDateStr(previousWeekDates[0]),
    to: toDateStr(previousWeekDates[6]),
  });
  const shiftTypesQuery = useListShiftTypes();
  const staffQuery = useListStaff();
  const shifts = shiftsQuery.data ?? [];
  const shiftTypes = shiftTypesQuery.data ?? [];
  const activeShiftTypes = (shiftTypes as any[]).filter((t) => t.isActive);
  const staffListAll = staffQuery.data ?? [];
  // 職員一覧で「非表示」にした職員はシフト管理にも出さない
  const staffList = (staffListAll as any[]).filter((s) => s.isVisible !== false);
  const bulkMut = useBulkUpsertShifts({
    mutation: {
      onSuccess: () => qc.invalidateQueries({ queryKey: getListShiftsQueryKey() }),
    },
  });
  const deleteMut = useDeleteShift({
    mutation: {
      onSuccess: () => qc.invalidateQueries({ queryKey: getListShiftsQueryKey() }),
    },
  });

  const prevWeek = () => setWeekStart((d) => addDays(d, -7));
  const nextWeek = () => setWeekStart((d) => addDays(d, 7));
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

  function toggleCell(staffId: number, date: string) {
    const key = `${staffId}-${date}`;
    setSelectedCells((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  async function applyBulkShift() {
    if (!bulkShiftTypeId || selectedCells.size === 0) return;
    const targets = [...selectedCells].map((key) => {
      const splitAt = key.indexOf("-");
      return {
        staffId: Number(key.slice(0, splitAt)),
        date: key.slice(splitAt + 1),
        shiftTypeId: bulkShiftTypeId,
        slotLabel: "",
      };
    });
    const overwriteCount = targets.filter((t) => Boolean(getShift(t.staffId, t.date))).length;
    if (overwriteCount > 0 && !confirm(`${targets.length}件のうち${overwriteCount}件は登録済みです。上書きしますか？`)) return;
    try {
      await bulkMut.mutateAsync({ data: { shifts: targets } });
      setSelectedCells(new Set());
      setBulkMode(false);
      setBulkShiftTypeId("");
      toast({ title: `${targets.length}件のシフトを設定しました` });
    } catch {
      toast({
        title: "一括設定に失敗しました",
        description: `対象${targets.length}件は保存されていません。もう一度実行してください。`,
        variant: "destructive",
      });
    }
  }

  async function copyPreviousWeek() {
    const visibleStaffIds = new Set((staffList as any[]).map((s) => s.id));
    const source = (previousShiftsQuery.data ?? []).filter((s: any) => visibleStaffIds.has(s.staffId));
    if (source.length === 0) {
      toast({ title: "前週にコピーできるシフトがありません" });
      return;
    }
    const targets = (source as any[]).map((s) => ({
      staffId: s.staffId,
      date: toDateStr(addDays(parseISO(s.date), 7)),
      shiftTypeId: s.shiftTypeId,
      slotLabel: s.slotLabel ?? "",
      startTime: s.startTime ?? null,
      endTime: s.endTime ?? null,
      notes: s.notes ?? null,
    }));
    const overwriteCount = targets.filter((t) => Boolean(getShift(t.staffId, t.date))).length;
    const message = overwriteCount > 0 ? `前週から${targets.length}件をコピーします。登録済みの${overwriteCount}件は上書きされます。よろしいですか？` : `前週から${targets.length}件をコピーします。よろしいですか？`;
    if (!confirm(message)) return;
    try {
      await bulkMut.mutateAsync({ data: { shifts: targets } });
      toast({ title: `${targets.length}件を前週からコピーしました` });
    } catch {
      toast({
        title: "前週のコピーに失敗しました",
        description: `対象${targets.length}件は保存されていません。もう一度実行してください。`,
        variant: "destructive",
      });
    }
  }

  const WEEKDAY_LABELS = ["日", "月", "火", "水", "木", "金", "土"];
  const isLoading = shiftsQuery.isLoading || shiftTypesQuery.isLoading || staffQuery.isLoading;
  const hasError = shiftsQuery.isError || shiftTypesQuery.isError || staffQuery.isError;
  const isThisWeek = toDateStr(weekStart) === toDateStr(startOfWeek(new Date(), { weekStartsOn: 0 }));
  const activeRequiredTypes = activeShiftTypes.filter((t) => (t.requiredStaffCount ?? 0) > 0);
  const assignedCellCount = (staffList as any[]).reduce((total, staff) => total + weekDates.filter((d) => Boolean(getShift(staff.id, toDateStr(d)))).length, 0);
  const totalCellCount = (staffList as any[]).length * weekDates.length;
  const selectedPaintType = paintShiftTypeId === "__clear__" ? null : activeShiftTypes.find((t) => t.id === paintShiftTypeId);
  const shortages = weekDates.flatMap((d) => {
    const date = toDateStr(d);
    return activeRequiredTypes.flatMap((type) => {
      const assigned = (shifts as any[]).filter((s) => s.date === date && s.shiftTypeId === type.id).length;
      return assigned < type.requiredStaffCount
        ? [
            {
              date,
              type,
              assigned,
              missing: type.requiredStaffCount - assigned,
            },
          ]
        : [];
    });
  });
  const consecutiveWarnings = (staffList as any[]).flatMap((staff) => {
    const worked = weekDates.filter((d) => Boolean(getShift(staff.id, toDateStr(d)))).length;
    return worked === 7 ? [{ staff, worked }] : [];
  });

  return (
    <Layout>
      <div className="space-y-4 max-w-6xl">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-800">シフト管理</h1>
            <p className="text-xs text-gray-500 mt-0.5">職員の週次シフトを設定します</p>
          </div>
          <div className="flex w-full items-center gap-1.5 lg:w-auto lg:justify-end">
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={prevWeek}>
              <ChevronLeft className="h-4 w-4" />
              <span className="sr-only">前の週</span>
            </Button>
            <span className="min-w-0 flex-1 text-center text-sm font-medium text-gray-700 sm:min-w-[170px] lg:flex-none">
              {format(weekDates[0], "yyyy年M月d日", { locale: ja })} 〜 {format(weekDates[6], "M月d日", { locale: ja })}
            </span>
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={nextWeek}>
              <ChevronRight className="h-4 w-4" />
              <span className="sr-only">次の週</span>
            </Button>
            <Button variant={isThisWeek ? "secondary" : "outline"} size="sm" className="h-8 px-2.5 ml-1" onClick={goToThisWeek} disabled={isThisWeek}>
              <CalendarDays className="h-3.5 w-3.5 mr-1" />
              今週
            </Button>
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="flex flex-col gap-2 border-b border-gray-100 p-2.5 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant={bulkMode ? "secondary" : "outline"}
                size="sm"
                onClick={() => {
                  setBulkMode((value) => !value);
                  setSelectedCells(new Set());
                  setBulkShiftTypeId("");
                  setPaintShiftTypeId(null);
                }}
              >
                <CheckSquare2 className="mr-1.5 h-4 w-4" />
                {bulkMode ? "まとめて入力を終了" : "まとめて入力"}
              </Button>
              <Button variant="outline" size="sm" onClick={copyPreviousWeek} disabled={previousShiftsQuery.isLoading || bulkMut.isPending}>
                {bulkMut.isPending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Copy className="mr-1.5 h-4 w-4" />}
                前週をコピー
              </Button>
            </div>
            <div className="flex items-center gap-3 text-xs text-gray-500">
              <span>
                <strong className="text-gray-800">{staffList.length}</strong>名
              </span>
              <span>
                <strong className="text-gray-800">{assignedCellCount}</strong>/{totalCellCount}枠 入力済み
              </span>
              {shortages.length > 0 && <span className="font-semibold text-amber-700">不足 {shortages.length}項目</span>}
            </div>
          </div>

          {bulkMode ? (
            <div className="flex flex-wrap items-center gap-2 bg-blue-50/70 p-2.5">
              <span className="min-w-[76px] text-xs font-semibold text-blue-900">{selectedCells.size}枠を選択</span>
              <div className="w-44">
                <Select value={bulkShiftTypeId} onValueChange={setBulkShiftTypeId}>
                  <SelectTrigger className="h-8 bg-white text-xs">
                    <SelectValue placeholder="勤務を選択" />
                  </SelectTrigger>
                  <SelectContent>
                    {activeShiftTypes.map((st) => (
                      <SelectItem key={st.id} value={st.id}>
                        {st.code}　{st.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button size="sm" disabled={!bulkShiftTypeId || selectedCells.size === 0 || bulkMut.isPending} onClick={applyBulkShift}>
                選択した枠に設定
              </Button>
              <span className="text-xs text-blue-700">表のセルをクリックして対象を選びます</span>
            </div>
          ) : (
            <div className="flex flex-col gap-2 p-2.5 sm:flex-row sm:items-center">
              <div className="flex shrink-0 items-center gap-1.5 text-xs font-semibold text-gray-700">
                <MousePointer2 className="h-4 w-4 text-primary" />
                かんたん入力
              </div>
              <div className="flex min-w-0 flex-1 gap-1.5 overflow-x-auto pb-1 sm:pb-0">
                <Button type="button" size="sm" variant={paintShiftTypeId === null ? "secondary" : "outline"} className="h-8 shrink-0 text-xs" onClick={() => setPaintShiftTypeId(null)} aria-pressed={paintShiftTypeId === null}>
                  通常選択
                </Button>
                {activeShiftTypes.map((st) => (
                  <button
                    key={st.id}
                    type="button"
                    aria-pressed={paintShiftTypeId === st.id}
                    onClick={() => setPaintShiftTypeId(st.id)}
                    className={`h-8 shrink-0 rounded-md border px-2.5 text-xs font-semibold transition-all ${paintShiftTypeId === st.id ? "ring-2 ring-primary ring-offset-1" : "hover:border-gray-400"}`}
                    style={{
                      background: (st.color ?? "#64748b") + "18",
                      borderColor: (st.color ?? "#64748b") + "66",
                      color: st.color ?? "#475569",
                    }}
                    title={`${st.name}を連続入力`}
                  >
                    {st.code} <span className="font-normal opacity-80">{st.name}</span>
                  </button>
                ))}
                <Button
                  type="button"
                  size="sm"
                  variant={paintShiftTypeId === "__clear__" ? "secondary" : "outline"}
                  className="h-8 shrink-0 text-xs"
                  onClick={() => setPaintShiftTypeId("__clear__")}
                  aria-pressed={paintShiftTypeId === "__clear__"}
                >
                  <Eraser className="mr-1 h-3.5 w-3.5" />
                  未設定に戻す
                </Button>
              </div>
              {paintShiftTypeId !== null && (
                <span className="shrink-0 rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-semibold text-primary">{paintShiftTypeId === "__clear__" ? "セルを押すと消去" : `${selectedPaintType?.name ?? "勤務"}を連続入力中`}</span>
              )}
            </div>
          )}
        </div>

        <div className="md:hidden flex items-center gap-2 rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-700">
          <MoveHorizontal className="h-4 w-4 shrink-0" />
          表を横にスワイプすると、ほかの曜日を確認できます
        </div>

        {!isLoading && !hasError && (shortages.length > 0 || consecutiveWarnings.length > 0) && (
          <details className="group rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-semibold text-amber-900">
              <span className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4" />
                確認が必要な項目が
                {shortages.length + consecutiveWarnings.length}件あります
              </span>
              <span className="text-xs font-normal text-amber-700 group-open:hidden">詳細を見る</span>
              <span className="hidden text-xs font-normal text-amber-700 group-open:inline">閉じる</span>
            </summary>
            <div className="mt-2 flex flex-wrap gap-2 border-t border-amber-200 pt-2">
              {shortages.map((item) => (
                <span key={`${item.date}-${item.type.id}`} className="rounded-full bg-white border border-amber-200 px-2.5 py-1 text-xs text-amber-800">
                  {format(parseISO(item.date), "M/d")} {item.type.name}：あと
                  {item.missing}人
                </span>
              ))}
              {consecutiveWarnings.map((item) => (
                <span key={item.staff.id} className="rounded-full bg-white border border-amber-200 px-2.5 py-1 text-xs text-amber-800">
                  {item.staff.lastName} {item.staff.firstName}：週7日勤務
                </span>
              ))}
            </div>
          </details>
        )}

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
                  <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-600 min-w-28 sticky left-0 top-0 z-30 bg-gray-50 shadow-[2px_0_0_0_#e5e7eb]">職員</th>
                  {weekDates.map((d, i) => {
                    const isToday = toDateStr(d) === toDateStr(new Date());
                    return (
                      <th key={i} className={`min-w-[104px] px-2 py-2 text-center text-xs font-semibold ${isToday ? "bg-primary/10" : "bg-gray-50"} ${i === 0 ? "text-red-500" : i === 6 ? "text-blue-500" : "text-gray-600"}`}>
                        <div className="flex items-center justify-center gap-1">
                          {WEEKDAY_LABELS[d.getDay()]}
                          {isToday && <span className="rounded bg-primary px-1 py-0.5 text-[9px] leading-none text-white">今日</span>}
                        </div>
                        <div className="text-gray-400 font-normal">{format(d, "M/d")}</div>
                      </th>
                    );
                  })}
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
                {!isLoading && activeShiftTypes.length === 0 && (
                  <tr>
                    <td colSpan={8} className="text-center py-10 text-sm text-gray-500">
                      <p className="font-semibold text-gray-700">シフト種別が登録されていません</p>
                      <p className="text-xs mt-1">サイドメニューの「シフト種別」から勤務区分を登録してください。</p>
                    </td>
                  </tr>
                )}
                {!isLoading && activeShiftTypes.length > 0 && (staffList as any[]).length === 0 && (
                  <tr>
                    <td colSpan={8} className="text-center py-10 text-sm text-gray-500">
                      <p className="font-semibold text-gray-700">表示できる職員がいません</p>
                      <p className="text-xs mt-1">職員一覧で職員を登録するか、表示設定を確認してください。</p>
                    </td>
                  </tr>
                )}
                {!isLoading &&
                  activeShiftTypes.length > 0 &&
                  (staffList as any[]).map((staff) => {
                    const staffAssignedCount = weekDates.filter((d) => Boolean(getShift(staff.id, toDateStr(d)))).length;
                    return (
                      <tr key={staff.id} className="hover:bg-gray-50">
                        <td className="sticky left-0 z-10 min-w-32 whitespace-nowrap bg-white px-3 py-1.5 text-sm font-medium shadow-[2px_0_0_0_#f3f4f6]">
                          <div>
                            {staff.lastName} {staff.firstName}
                          </div>
                          <div className="text-[10px] font-normal text-gray-400">{staffAssignedCount}/7日 入力済み</div>
                        </td>
                        {weekDates.map((d) => {
                          const dateStr = toDateStr(d);
                          const shift = getShift(staff.id, dateStr);
                          const currentTypeId = shift?.shiftTypeId ?? "__clear__";
                          const cellKey = `${staff.id}-${dateStr}`;
                          const isSelected = selectedCells.has(cellKey);
                          const selectedType = (shiftTypes as any[]).find((t) => t.id === shift?.shiftTypeId);
                          return (
                            <td
                              key={dateStr}
                              className={`relative px-1 py-1 ${bulkMode || paintShiftTypeId !== null ? "cursor-pointer" : ""} ${toDateStr(d) === toDateStr(new Date()) ? "bg-primary/[0.025]" : ""}`}
                              onClick={() => bulkMode && toggleCell(staff.id, dateStr)}
                            >
                              {bulkMode ? (
                                <button
                                  type="button"
                                  className={`h-10 w-full rounded-md border-2 text-xs font-semibold transition-colors ${
                                    isSelected ? "border-primary bg-primary/10 text-primary" : "border-dashed border-gray-300 bg-gray-50 text-gray-500 hover:border-primary/50"
                                  }`}
                                >
                                  {isSelected ? "選択済み" : (selectedType?.code ?? "選択")}
                                </button>
                              ) : paintShiftTypeId !== null ? (
                                <button
                                  type="button"
                                  disabled={savingCell === cellKey}
                                  onClick={() => {
                                    if (paintShiftTypeId === currentTypeId || (paintShiftTypeId === "__clear__" && !shift)) return;
                                    void setShiftType(staff.id, dateStr, paintShiftTypeId);
                                  }}
                                  className={`flex h-10 w-full items-center justify-center rounded-md border text-xs transition-all hover:ring-2 hover:ring-primary/30 disabled:cursor-wait ${
                                    savingCell === cellKey ? "border-amber-200 bg-amber-50" : "border-gray-200 bg-white"
                                  }`}
                                  style={
                                    selectedType
                                      ? {
                                          background: (selectedType.color ?? "#64748b") + "14",
                                          borderColor: (selectedType.color ?? "#64748b") + "55",
                                        }
                                      : undefined
                                  }
                                  aria-label={`${staff.lastName} ${staff.firstName}、${format(d, "M月d日")}、${selectedType?.name ?? "未設定"}`}
                                >
                                  {savingCell === cellKey ? (
                                    <Loader2 className="h-4 w-4 animate-spin text-amber-600" />
                                  ) : selectedType ? (
                                    <span className="flex flex-col items-center leading-tight">
                                      <span
                                        className="font-bold"
                                        style={{
                                          color: selectedType.color ?? "#475569",
                                        }}
                                      >
                                        {selectedType.code}
                                      </span>
                                      {(selectedType.defaultStartTime || selectedType.defaultEndTime) && (
                                        <span className="mt-0.5 text-[9px] text-gray-500">
                                          {selectedType.defaultStartTime ?? "?"}–{selectedType.defaultEndTime ?? "?"}
                                        </span>
                                      )}
                                    </span>
                                  ) : (
                                    <span className="text-gray-300">—</span>
                                  )}
                                </button>
                              ) : (
                                <Select value={currentTypeId} onValueChange={(v) => setShiftType(staff.id, dateStr, v)} disabled={savingCell === cellKey}>
                                  <SelectTrigger
                                    className={`h-10 border-gray-200 px-1.5 text-xs ${savingCell === cellKey ? "bg-amber-50 border-amber-200" : savedCell === cellKey ? "bg-green-50 border-green-200" : ""}`}
                                    style={
                                      selectedType && savingCell !== cellKey && savedCell !== cellKey
                                        ? {
                                            background: (selectedType.color ?? "#64748b") + "14",
                                            borderColor: (selectedType.color ?? "#64748b") + "55",
                                          }
                                        : undefined
                                    }
                                    title={selectedType ? `${selectedType.name} ${selectedType.defaultStartTime ?? ""}〜${selectedType.defaultEndTime ?? ""}` : "シフトを選択"}
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
                                            style={{
                                              background: (selectedType.color ?? "#888") + "22",
                                              color: selectedType.color ?? "#555",
                                            }}
                                          >
                                            {selectedType.code}
                                          </span>
                                          {(selectedType.defaultStartTime || selectedType.defaultEndTime) && (
                                            <span className="text-[10px] text-gray-500 mt-0.5 truncate">
                                              {selectedType.defaultStartTime ?? "?"}–{selectedType.defaultEndTime ?? "?"}
                                            </span>
                                          )}
                                        </span>
                                      ) : (
                                        <span className="text-gray-300">—</span>
                                      )}
                                    </SelectValue>
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="__clear__">
                                      <span className="text-gray-400">— (なし)</span>
                                    </SelectItem>
                                    {activeShiftTypes.map((st) => (
                                      <SelectItem key={st.id} value={st.id}>
                                        <span
                                          className="px-1.5 py-0.5 rounded text-xs font-bold mr-2"
                                          style={{
                                            background: (st.color ?? "#888") + "22",
                                            color: st.color ?? "#555",
                                          }}
                                        >
                                          {st.code}
                                        </span>
                                        {st.name}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              )}
                              {savedCell === cellKey && <CheckCircle2 className="absolute right-0.5 top-0.5 h-3 w-3 text-green-600 bg-white rounded-full" />}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
              </tbody>
            </table>
            {!isLoading && activeRequiredTypes.length > 0 && (
              <div className="sticky bottom-0 left-0 min-w-max border-t border-gray-200 bg-gray-50/95 backdrop-blur px-3 py-2">
                <div className="flex gap-3 pl-28">
                  {weekDates.map((d) => {
                    const date = toDateStr(d);
                    const dayShortages = shortages.filter((s) => s.date === date);
                    return (
                      <div key={date} className="w-[112px] text-center text-[11px]">
                        {dayShortages.length === 0 ? <span className="text-green-700">✓ 配置OK</span> : <span className="font-semibold text-amber-700">不足 {dayShortages.reduce((n, s) => n + s.missing, 0)}人</span>}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
}
