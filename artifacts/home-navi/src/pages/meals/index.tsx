import { useState, useMemo, useEffect } from "react";
import { useLocation } from "wouter";
import { Layout } from "@/components/layout";
import { useListResidents, useListMeals } from "@workspace/api-client-react";
import type { Resident, Meal } from "@workspace/api-client-react";
import { MealEntryModal } from "@/components/MealEntryModal";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Utensils, CheckCircle2, AlertTriangle,
  ChevronRight, ClipboardCheck, FileSearch, Edit3, Settings2, Lock,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { format, isToday as dateFnsIsToday } from "date-fns";
import { DayNav } from "@/components/date-nav";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

type MealType = "朝食" | "昼食" | "夕食";
type StatusFilter = "すべて" | "未記録" | "記録済み" | "要確認";
type MealStatus = "未記録" | "確認OK" | "要確認";

const MEAL_TYPES: MealType[] = ["朝食", "昼食", "夕食"];
const STATUS_FILTERS: StatusFilter[] = ["すべて", "未記録", "記録済み", "要確認"];

const MEAL_WINDOW: Record<MealType, { label: string; start: number; end: number }> = {
  "朝食": { label: "6:00〜10:59", start: 6, end: 10 },
  "昼食": { label: "11:00〜16:59", start: 11, end: 16 },
  "夕食": { label: "17:00〜23:59", start: 17, end: 23 },
};

function getJSTHour(): number {
  const now = new Date();
  const jst = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Tokyo" }));
  return jst.getHours();
}

function getCurrentMealType(): MealType {
  const h = getJSTHour();
  if (h >= 6 && h <= 10) return "朝食";
  if (h >= 11 && h <= 16) return "昼食";
  return "夕食";
}

function isMealEditable(mealType: MealType, dateIsToday: boolean): boolean {
  if (!dateIsToday) return true;
  if (mealType === "昼食") return true;
  const h = getJSTHour();
  if (mealType === "朝食") return h >= 6 && h <= 10;
  if (mealType === "夕食") return h >= 17;
  return true;
}

function deriveMealStatus(meal: Meal | undefined): MealStatus {
  if (!meal) return "未記録";
  if (meal.waterOnly) return "確認OK";
  const main = meal.mainDishPercent ?? 0;
  if (main < 5) return "要確認";
  return "確認OK";
}

function getMeal(map: Record<string, Meal>, residentId: number, type: MealType): Meal | undefined {
  return map[`${residentId}-${type}`];
}

const STATUS_SORT: Record<MealStatus, number> = { "未記録": 0, "要確認": 1, "確認OK": 2 };

function MealStatusCell({
  meal, onClick, locked,
}: { meal: Meal | undefined; onClick?: () => void; locked?: boolean }) {
  const status = deriveMealStatus(meal);
  const base =
    "w-full rounded-lg py-2 px-1 transition-colors focus:outline-none focus:ring-2 focus:ring-primary/40";

  if (locked) {
    return (
      <div className={`${base} flex justify-center opacity-40 cursor-not-allowed`}>
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs text-gray-400 border border-gray-200">
          <Lock className="h-3 w-3" />
          {status === "未記録" ? "未記録" : status === "要確認" ? "要確認" : "記録済み"}
        </span>
      </div>
    );
  }

  if (status === "未記録") {
    return (
      <button type="button" onClick={onClick} className={`${base} flex justify-center hover:bg-gray-50 active:bg-gray-100 cursor-pointer`}>
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold border border-orange-400 text-orange-500">未記録</span>
      </button>
    );
  }
  if (status === "要確認") {
    return (
      <button type="button" onClick={onClick} className={`${base} flex flex-col items-center gap-0.5 hover:bg-gray-50 active:bg-gray-100 cursor-pointer`}>
        <span className="text-xs text-gray-600">
          主:{meal?.mainDishPercent ?? "—"}割 副:{meal?.sideDishPercent ?? "—"}割
        </span>
        <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded text-xs font-bold bg-red-100 text-red-600">
          <AlertTriangle className="h-3 w-3" />要確認
        </span>
        {meal?.medicationOk && <span className="text-xs text-green-600 font-semibold">服薬OK</span>}
      </button>
    );
  }
  return (
    <button type="button" onClick={onClick} className={`${base} flex flex-col items-center gap-0.5 hover:bg-gray-50 active:bg-gray-100 cursor-pointer`}>
      {meal?.waterOnly ? (
        <span className="text-xs text-blue-500 font-semibold">水分のみ</span>
      ) : (
        <span className="text-xs text-gray-600">
          主:{meal?.mainDishPercent ?? "—"}割 副:{meal?.sideDishPercent ?? "—"}割
        </span>
      )}
      <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded text-xs font-bold bg-green-100 text-green-600">
        <CheckCircle2 className="h-3 w-3" />確認OK
      </span>
      {meal?.medicationOk && <span className="text-xs text-green-600 font-semibold">服薬OK</span>}
    </button>
  );
}

function AlertColumn({ resident }: { resident: Resident }) {
  const alerts: Array<{ text: string; red: boolean }> = [];
  const allText = ((resident.medicalHistory ?? "") + " " + (resident.characterNotes ?? "")).toLowerCase();
  if (allText.includes("アレルギー") || allText.includes("allerg")) alerts.push({ text: "アレルギー注意", red: true });
  if (allText.includes("むせ")) alerts.push({ text: "むせ注意", red: false });
  if (allText.includes("嚥下")) alerts.push({ text: "嚥下注意", red: true });
  if (resident.stomaManagement) alerts.push({ text: "ストーマ管理", red: false });
  if (alerts.length === 0) return <span className="text-xs text-gray-300">特になし</span>;
  return (
    <div className="flex flex-col gap-1">
      {alerts.slice(0, 2).map((a, i) => (
        <span key={i} className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-xs font-semibold whitespace-nowrap ${a.red ? "bg-red-100 text-red-600" : "bg-orange-100 text-orange-600"}`}>
          <AlertTriangle className="h-3 w-3 shrink-0" />{a.text}
        </span>
      ))}
    </div>
  );
}

interface QuickActionBtnProps {
  icon: LucideIcon;
  label: string;
  bg: string;
  iconBg: string;
  onClick?: () => void;
  disabled?: boolean;
}
function QuickActionBtn({ icon: Icon, label, bg, iconBg, onClick, disabled }: QuickActionBtnProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl ${bg} hover:opacity-90 transition-opacity text-left disabled:opacity-40 disabled:cursor-not-allowed`}
    >
      <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${iconBg} shrink-0`}>
        <Icon className="h-4 w-4 text-white" />
      </div>
      <span className="text-xs font-semibold text-gray-700">{label}</span>
      <ChevronRight className="h-3.5 w-3.5 text-gray-400 ml-auto shrink-0" />
    </button>
  );
}

interface SidePanelProps {
  allResidents: Resident[];
  mealMap: Record<string, Meal>;
  floorFilter: string;
  activeMealType: MealType;
  onOpenBulkEdit: () => void;
  dateIsToday: boolean;
}
function SidePanel({ allResidents, mealMap, floorFilter, activeMealType, onOpenBulkEdit, dateIsToday }: SidePanelProps) {
  const [memo, setMemo] = useState("");
  const [, nav] = useLocation();

  const baseResidents = floorFilter === "all"
    ? allResidents
    : allResidents.filter((r) => Math.floor(parseInt(r.roomNumber) / 100) === parseInt(floorFilter));

  const needsCheck = baseResidents.filter((r) =>
    MEAL_TYPES.some((t) => deriveMealStatus(getMeal(mealMap, r.id, t)) === "要確認")
  );

  const win = MEAL_WINDOW[activeMealType];
  const editable = isMealEditable(activeMealType, dateIsToday);

  return (
    <div className="w-64 shrink-0 flex flex-col gap-4">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 space-y-2">
        <h3 className="text-xs font-bold text-gray-700 mb-1">クイック操作</h3>
        {dateIsToday && (
          <div className={`px-3 py-2 rounded-xl text-xs font-semibold mb-1 ${editable ? "bg-orange-50 text-orange-700" : "bg-gray-50 text-gray-500"}`}>
            {editable
              ? `${activeMealType}の入力時間帯 (${win.label})`
              : `${activeMealType}の時間外 — 編集不可`}
          </div>
        )}
        <QuickActionBtn
          icon={Edit3}
          label={`${activeMealType}を一括入力`}
          bg="bg-orange-50"
          iconBg="bg-orange-500"
          onClick={onOpenBulkEdit}
          disabled={!editable && dateIsToday}
        />
        <QuickActionBtn
          icon={Edit3}
          label="全食事を編集（管理者）"
          bg="bg-blue-50"
          iconBg="bg-blue-500"
          onClick={onOpenBulkEdit}
        />
        <QuickActionBtn
          icon={ClipboardCheck}
          label="記録チェック"
          bg="bg-green-50"
          iconBg="bg-green-500"
          onClick={() => nav("/meals/records")}
        />
        <QuickActionBtn
          icon={FileSearch}
          label="食事形態の確認"
          bg="bg-purple-50"
          iconBg="bg-purple-500"
        />
      </div>

      {needsCheck.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-orange-100 p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-bold text-orange-700">要確認の方（{needsCheck.length}名）</h3>
          </div>
          <div className="space-y-2">
            {needsCheck.slice(0, 5).map((r) => (
              <div key={r.id} className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <span className="text-xs text-gray-500 mr-1">{r.roomNumber}</span>
                  <span className="text-xs font-semibold text-gray-800">{r.lastName}{r.firstName}</span>
                </div>
                <div className="flex gap-0.5 shrink-0">
                  {MEAL_TYPES.map((t) => {
                    const s = deriveMealStatus(getMeal(mealMap, r.id, t));
                    if (s !== "要確認") return null;
                    return <span key={t} className="px-1 py-0.5 rounded text-xs font-bold bg-red-100 text-red-600">{t[0]}</span>;
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xs font-bold text-gray-700">スタッフメモ</h3>
          <button className="text-xs text-primary font-medium">編集</button>
        </div>
        <textarea
          value={memo}
          onChange={(e) => setMemo(e.target.value)}
          placeholder="今日の引き継ぎメモを入力…"
          className="w-full text-xs text-gray-600 resize-none bg-gray-50 rounded-lg p-2 border border-gray-100 focus:outline-none focus:border-orange-300 h-20"
        />
      </div>
    </div>
  );
}

interface MobileMealCardProps {
  resident: Resident;
  mealMap: Record<string, Meal>;
  activeMealType: MealType;
  onEdit: (mealType: MealType) => void;
  dateIsToday: boolean;
}
function MobileMealCard({ resident, mealMap, activeMealType, onEdit, dateIsToday }: MobileMealCardProps) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-50">
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">{resident.roomNumber}</span>
          <span className="text-sm font-bold text-gray-800">{resident.lastName} {resident.firstName}</span>
        </div>
        <AlertColumn resident={resident} />
      </div>
      <div className="px-4 py-3 grid grid-cols-3 gap-2">
        {MEAL_TYPES.map((t) => {
          const meal = getMeal(mealMap, resident.id, t);
          const status = deriveMealStatus(meal);
          const isActive = t === activeMealType;
          const locked = !isMealEditable(t, dateIsToday);
          return (
            <button
              key={t}
              type="button"
              onClick={() => !locked && onEdit(t)}
              disabled={locked}
              className={`rounded-xl p-2 text-center transition-colors focus:outline-none focus:ring-2 focus:ring-primary/40 ${
                locked
                  ? "bg-gray-50 opacity-50 cursor-not-allowed"
                  : isActive
                  ? "bg-orange-50 ring-1 ring-orange-200 hover:opacity-80 active:opacity-70 cursor-pointer"
                  : "bg-gray-50 hover:opacity-80 active:opacity-70 cursor-pointer"
              }`}
            >
              <div className={`text-xs font-bold mb-1 flex items-center justify-center gap-0.5 ${locked ? "text-gray-400" : isActive ? "text-primary" : "text-gray-500"}`}>
                {t[0]}{locked && <Lock className="h-2.5 w-2.5" />}
              </div>
              {status === "未記録" ? (
                <span className={`inline-flex px-1.5 py-0.5 rounded text-xs font-bold ${locked ? "border border-gray-300 text-gray-400" : "border border-orange-400 text-orange-500"}`}>未記録</span>
              ) : status === "要確認" ? (
                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-xs font-bold bg-red-100 text-red-600">
                  <AlertTriangle className="h-3 w-3" />要確認
                </span>
              ) : (
                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-xs font-bold bg-green-100 text-green-600">
                  <CheckCircle2 className="h-3 w-3" />OK
                </span>
              )}
              {meal && !meal.waterOnly && status !== "未記録" && (
                <div className="text-xs text-gray-400 mt-0.5 leading-none">主:{meal.mainDishPercent ?? "—"}割</div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

interface EditTarget {
  resident: Resident;
  mealType: MealType;
}

const DATE_KEY = "meals-selected-date";

function loadDate(): Date {
  try {
    const s = sessionStorage.getItem(DATE_KEY);
    if (s) return new Date(s);
  } catch {}
  return new Date();
}

export default function MealsList() {
  const [date, setDate] = useState<Date>(loadDate);
  const [activeMealType, setActiveMealType] = useState<MealType>(getCurrentMealType);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("すべて");
  const [floorFilter, setFloorFilter] = useState("all");
  const [editTarget, setEditTarget] = useState<EditTarget | null>(null);
  const [bulkEditOpen, setBulkEditOpen] = useState(false);
  const [, nav] = useLocation();

  const dateStr = format(date, "yyyy-MM-dd");
  const dateIsToday = dateFnsIsToday(date);

  useEffect(() => {
    try { sessionStorage.setItem(DATE_KEY, date.toISOString()); } catch {}
  }, [date]);

  useEffect(() => {
    if (dateIsToday) setActiveMealType(getCurrentMealType());
  }, [dateIsToday]);

  const openEdit = (resident: Resident, mealType: MealType) => {
    if (!isMealEditable(mealType, dateIsToday)) return;
    setEditTarget({ resident, mealType });
  };

  const { data: residents = [], isLoading: isResidentsLoading } = useListResidents();
  const { data: meals = [], isLoading: isMealsLoading } = useListMeals({ date: dateStr });
  const isLoading = isResidentsLoading || isMealsLoading;

  const mealMap = useMemo<Record<string, Meal>>(() => {
    const map: Record<string, Meal> = {};
    meals.forEach((m) => { map[`${m.residentId}-${m.mealType}`] = m; });
    return map;
  }, [meals]);

  const floors = useMemo(() => {
    const set = new Set<number>();
    residents.forEach((r) => {
      const n = parseInt(r.roomNumber);
      if (!isNaN(n)) set.add(Math.floor(n / 100));
    });
    return Array.from(set).sort();
  }, [residents]);

  const floorResidents = useMemo<Resident[]>(() => {
    if (floorFilter === "all") return residents;
    const floor = parseInt(floorFilter);
    return residents.filter((r) => Math.floor(parseInt(r.roomNumber) / 100) === floor);
  }, [residents, floorFilter]);

  const sortedAndFiltered = useMemo<Resident[]>(() => {
    let list = floorResidents;
    if (statusFilter !== "すべて") {
      list = list.filter((r) => {
        const status = deriveMealStatus(getMeal(mealMap, r.id, activeMealType));
        if (statusFilter === "未記録") return status === "未記録";
        if (statusFilter === "記録済み") return status === "確認OK";
        if (statusFilter === "要確認") return status === "要確認";
        return true;
      });
    }
    return [...list].sort((a, b) => {
      const sa = deriveMealStatus(getMeal(mealMap, a.id, activeMealType));
      const sb = deriveMealStatus(getMeal(mealMap, b.id, activeMealType));
      return STATUS_SORT[sa] - STATUS_SORT[sb];
    });
  }, [floorResidents, mealMap, statusFilter, activeMealType]);

  const statusCounts = useMemo<Record<StatusFilter, number>>(() => ({
    "すべて": floorResidents.length,
    "未記録": floorResidents.filter((r) => deriveMealStatus(getMeal(mealMap, r.id, activeMealType)) === "未記録").length,
    "記録済み": floorResidents.filter((r) => deriveMealStatus(getMeal(mealMap, r.id, activeMealType)) === "確認OK").length,
    "要確認": floorResidents.filter((r) => deriveMealStatus(getMeal(mealMap, r.id, activeMealType)) === "要確認").length,
  }), [floorResidents, mealMap, activeMealType]);

  return (
    <Layout>
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <Utensils className="h-5 w-5 text-primary" />
            食事
          </h1>
          <DayNav date={date} onChange={setDate} />
        </div>

        {/* Filter bar */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-3 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xs font-semibold text-gray-500 hidden sm:block">ユニット/フロア</span>
            <Select value={floorFilter} onValueChange={setFloorFilter}>
              <SelectTrigger className="h-8 text-xs w-36 rounded-lg border-gray-200">
                <SelectValue placeholder="フロアを選択" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全フロア</SelectItem>
                {floors.map((f) => (
                  <SelectItem key={f} value={String(f)}>{f}階</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="h-5 w-px bg-gray-100 hidden sm:block" />

          {/* Meal type tabs with time-lock indicator */}
          <div className="flex items-center gap-1">
            <span className="text-xs font-semibold text-gray-500 mr-1 hidden sm:block">食事タイプ</span>
            {MEAL_TYPES.map((t) => {
              const locked = !isMealEditable(t, dateIsToday);
              return (
                <button
                  key={t}
                  onClick={() => setActiveMealType(t)}
                  className={`h-8 px-3 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${
                    activeMealType === t
                      ? "bg-primary text-white shadow-sm"
                      : locked
                      ? "border border-gray-200 text-gray-400 bg-gray-50"
                      : "border border-gray-200 text-gray-600 hover:border-orange-300 hover:text-primary"
                  }`}
                >
                  {t}
                  {locked && dateIsToday && <Lock className="h-3 w-3 opacity-60" />}
                </button>
              );
            })}
          </div>

          <div className="h-5 w-px bg-gray-100 hidden sm:block" />

          {/* Status filter */}
          <div className="flex items-center gap-1 flex-wrap">
            <span className="text-xs font-semibold text-gray-500 mr-1 hidden sm:block">絞り込み</span>
            {STATUS_FILTERS.map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`h-8 px-3 rounded-lg text-xs font-semibold transition-all relative ${
                  statusFilter === s
                    ? "bg-primary text-white shadow-sm"
                    : "border border-gray-200 text-gray-600 hover:border-orange-300 hover:text-primary"
                }`}
              >
                {s}
                {statusCounts[s] > 0 && statusFilter !== s && (
                  <span className="absolute -top-1.5 -right-1.5 h-4 min-w-[16px] px-0.5 bg-gray-400 text-white text-xs rounded-full flex items-center justify-center font-bold leading-none">
                    {statusCounts[s]}
                  </span>
                )}
              </button>
            ))}
          </div>

          <button
            onClick={() => nav("/meals/records")}
            className="ml-auto p-2 rounded-lg border border-gray-200 text-gray-500 hover:border-orange-300 hover:text-primary transition-colors shrink-0"
            title="記録チェック"
          >
            <ClipboardCheck className="h-4 w-4" />
          </button>
          <button className="p-2 rounded-lg border border-gray-200 text-gray-500 hover:border-orange-300 hover:text-primary transition-colors shrink-0">
            <Settings2 className="h-4 w-4" />
          </button>
        </div>

        {/* Desktop: table + side panel */}
        <div className="hidden md:flex gap-4 items-start">
          <div className="flex-1 min-w-0 bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50 border-b border-gray-100">
                    <TableHead className="w-12 text-xs font-bold text-gray-600 px-3">居室</TableHead>
                    <TableHead className="min-w-[100px] text-xs font-bold text-gray-600">氏名</TableHead>
                    {MEAL_TYPES.map((t) => {
                      const locked = !isMealEditable(t, dateIsToday);
                      return (
                        <TableHead key={t} className={`text-center text-xs font-bold min-w-[90px] ${activeMealType === t ? "text-primary" : locked ? "text-gray-400" : "text-gray-600"}`}>
                          <span className="flex items-center justify-center gap-1">
                            {t}{locked && dateIsToday && <Lock className="h-3 w-3" />}
                          </span>
                        </TableHead>
                      );
                    })}
                    <TableHead className="text-xs font-bold text-gray-600 min-w-[110px]">備考・アラート</TableHead>
                    <TableHead className="text-xs font-bold text-gray-600 w-20">個人入力</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    Array.from({ length: 6 }).map((_, i) => (
                      <TableRow key={i} className="border-b border-gray-50">
                        <TableCell><Skeleton className="h-4 w-8" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                        <TableCell><Skeleton className="h-10 w-full" /></TableCell>
                        <TableCell><Skeleton className="h-10 w-full" /></TableCell>
                        <TableCell><Skeleton className="h-10 w-full" /></TableCell>
                        <TableCell><Skeleton className="h-6 w-20" /></TableCell>
                        <TableCell><Skeleton className="h-6 w-16" /></TableCell>
                      </TableRow>
                    ))
                  ) : sortedAndFiltered.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-12 text-gray-400 text-sm">
                        該当する利用者がいません
                      </TableCell>
                    </TableRow>
                  ) : (
                    sortedAndFiltered.map((resident) => {
                      const needsAttn = MEAL_TYPES.some(
                        (t) => deriveMealStatus(getMeal(mealMap, resident.id, t)) === "要確認"
                      );
                      return (
                        <TableRow key={resident.id} className={`border-b border-gray-50 hover:bg-gray-50 transition-colors ${needsAttn ? "bg-red-50/30" : ""}`}>
                          <TableCell className="text-xs text-gray-400 px-3">{resident.roomNumber}</TableCell>
                          <TableCell className="text-sm font-semibold text-gray-800 whitespace-nowrap">
                            {resident.lastName} {resident.firstName}
                          </TableCell>
                          {MEAL_TYPES.map((t) => {
                            const locked = !isMealEditable(t, dateIsToday);
                            return (
                              <TableCell key={t} className={`py-1 ${activeMealType === t ? "bg-orange-50/30" : ""}`}>
                                <MealStatusCell
                                  meal={getMeal(mealMap, resident.id, t)}
                                  onClick={locked ? undefined : () => openEdit(resident, t)}
                                  locked={locked}
                                />
                              </TableCell>
                            );
                          })}
                          <TableCell className="py-2">
                            <AlertColumn resident={resident} />
                          </TableCell>
                          <TableCell className="py-1">
                            <button
                              onClick={() => nav(`/meals/records/${resident.id}`)}
                              className="w-full flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg text-xs font-semibold text-primary border border-primary/30 hover:bg-orange-50 transition-colors"
                            >
                              <ClipboardCheck className="h-3.5 w-3.5" />
                              記録
                            </button>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
            <div className="px-4 py-2 border-t border-gray-50 text-xs text-gray-400">
              {sortedAndFiltered.length}名 表示中（未記録・要確認を上位表示）
            </div>
          </div>

          <SidePanel
            allResidents={residents}
            mealMap={mealMap}
            floorFilter={floorFilter}
            activeMealType={activeMealType}
            onOpenBulkEdit={() => setBulkEditOpen(true)}
            dateIsToday={dateIsToday}
          />
        </div>

        {/* Mobile: card layout */}
        <div className="md:hidden space-y-3">
          {/* Mobile quick actions */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-3 flex gap-2">
            <button
              onClick={() => nav("/meals/records")}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-green-50 text-xs font-semibold text-green-700"
            >
              <ClipboardCheck className="h-4 w-4" />記録チェック
            </button>
            <button
              onClick={() => setBulkEditOpen(true)}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-orange-50 text-xs font-semibold text-orange-700"
            >
              <Edit3 className="h-4 w-4" />一括入力
            </button>
          </div>

          {dateIsToday && (
            <div className="bg-blue-50 border border-blue-100 rounded-xl px-3 py-2 flex items-center gap-2 text-xs text-blue-700">
              <Lock className="h-3.5 w-3.5 shrink-0" />
              <span>
                現在は<strong>{getCurrentMealType()}</strong>の時間帯です。朝食・夕食は時間外のため編集できません。
              </span>
            </div>
          )}

          {isLoading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="bg-white rounded-2xl border border-gray-100 p-4">
                <Skeleton className="h-4 w-32 mb-3" />
                <div className="grid grid-cols-3 gap-2">
                  {[0, 1, 2].map((j) => <Skeleton key={j} className="h-14 rounded-xl" />)}
                </div>
              </div>
            ))
          ) : sortedAndFiltered.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-100 py-14 text-center text-gray-400">
              該当する利用者がいません
            </div>
          ) : (
            sortedAndFiltered.map((resident) => (
              <MobileMealCard
                key={resident.id}
                resident={resident}
                mealMap={mealMap}
                activeMealType={activeMealType}
                onEdit={(t) => openEdit(resident, t)}
                dateIsToday={dateIsToday}
              />
            ))
          )}
        </div>
      </div>

      {editTarget && (
        <MealEntryModal
          open={!!editTarget}
          onClose={() => setEditTarget(null)}
          resident={editTarget.resident}
          mealType={editTarget.mealType}
          date={dateStr}
          existingMeal={getMeal(mealMap, editTarget.resident.id, editTarget.mealType)}
        />
      )}
    </Layout>
  );
}
