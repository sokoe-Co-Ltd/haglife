import { useState, useMemo } from "react";
import { useLocation, useRoute } from "wouter";
import { Layout } from "@/components/layout";
import { useGetResident, useListMeals } from "@workspace/api-client-react";
import type { Meal } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import {
  CheckCircle2, AlertTriangle, ChevronLeft, ChevronRight,
  CalendarDays, Utensils, Droplets,
} from "lucide-react";
import {
  format, parseISO, startOfMonth, endOfMonth,
  eachDayOfInterval, isSameDay, getYear, getMonth,
} from "date-fns";
import { ja } from "date-fns/locale";
import { MealEntryModal } from "@/components/MealEntryModal";

type MealType = "朝食" | "昼食" | "夕食";
type ViewMode = "月別" | "年別";
type MealStatus = "未記録" | "確認OK" | "要確認";

const MEAL_TYPES: MealType[] = ["朝食", "昼食", "夕食"];

function deriveMealStatus(meal: Meal | undefined): MealStatus {
  if (!meal) return "未記録";
  if (meal.waterOnly) return "確認OK";
  const main = meal.mainDishPercent ?? 0;
  if (main < 5) return "要確認";
  return "確認OK";
}

function MealTypeBadge({ type, meal }: { type: MealType; meal: Meal | undefined }) {
  const status = deriveMealStatus(meal);
  if (status === "未記録") return (
    <div className="flex-1 rounded-lg px-2 py-1.5 bg-gray-50 border border-gray-100">
      <div className="text-xs font-bold text-gray-400 mb-0.5">{type[0]}</div>
      <span className="text-xs text-gray-400">未記録</span>
    </div>
  );
  if (status === "要確認") return (
    <div className="flex-1 rounded-lg px-2 py-1.5 bg-red-50 border border-red-100">
      <div className="text-xs font-bold text-red-500 mb-0.5 flex items-center gap-0.5">
        {type[0]}<AlertTriangle className="h-2.5 w-2.5" />
      </div>
      {meal?.waterOnly ? (
        <span className="text-xs text-blue-500">水分のみ</span>
      ) : (
        <div className="text-xs text-red-600">
          主{meal?.mainDishPercent ?? "—"}% 副{meal?.sideDishPercent ?? "—"}%
        </div>
      )}
      {meal?.medicationOk && (
        <div className="text-xs text-green-600 mt-0.5">
          服薬OK{meal.medicationByName ? `（${meal.medicationByName}）` : ""}
        </div>
      )}
    </div>
  );
  return (
    <div className="flex-1 rounded-lg px-2 py-1.5 bg-green-50 border border-green-100">
      <div className="text-xs font-bold text-green-600 mb-0.5 flex items-center gap-0.5">
        {type[0]}<CheckCircle2 className="h-2.5 w-2.5" />
      </div>
      {meal?.waterOnly ? (
        <span className="text-xs text-blue-500 flex items-center gap-0.5"><Droplets className="h-2.5 w-2.5" />水分のみ</span>
      ) : (
        <div className="text-xs text-green-700">
          主{meal?.mainDishPercent ?? "—"}% 副{meal?.sideDishPercent ?? "—"}%
        </div>
      )}
      {meal?.waterMl != null && (
        <div className="text-xs text-blue-500 mt-0.5 flex items-center gap-0.5">
          <Droplets className="h-2.5 w-2.5" />{meal.waterMl}mL
        </div>
      )}
      {meal?.medicationOk && (
        <div className="text-xs text-green-600 mt-0.5">
          服薬OK{meal.medicationByName ? `（${meal.medicationByName}）` : ""}
        </div>
      )}
    </div>
  );
}

interface MonthlyViewProps {
  mealsByDate: Map<string, Meal[]>;
  year: number;
  month: number;
  onEdit: (meal: Meal) => void;
  onNewEntry: (date: string, mealType: MealType) => void;
}
function MonthlyView({ mealsByDate, year, month, onEdit, onNewEntry }: MonthlyViewProps) {
  const monthStart = startOfMonth(new Date(year, month, 1));
  const monthEnd = endOfMonth(monthStart);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

  const daysWithData = days.filter((d) => {
    const key = format(d, "yyyy-MM-dd");
    return mealsByDate.has(key);
  });

  if (daysWithData.length === 0) {
    return (
      <div className="py-12 text-center text-gray-400 text-sm">
        この月の記録はありません
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {daysWithData.map((day) => {
        const key = format(day, "yyyy-MM-dd");
        const dayMeals = mealsByDate.get(key) ?? [];
        const mealMap = Object.fromEntries(dayMeals.map((m) => [m.mealType, m]));
        const isToday = isSameDay(day, new Date());
        return (
          <div key={key} className={`bg-white rounded-2xl border shadow-sm overflow-hidden ${isToday ? "border-primary/30" : "border-gray-100"}`}>
            <div className={`px-4 py-2 flex items-center justify-between ${isToday ? "bg-orange-50" : "bg-gray-50"}`}>
              <div className="flex items-center gap-2">
                <CalendarDays className={`h-4 w-4 ${isToday ? "text-primary" : "text-gray-400"}`} />
                <span className={`text-sm font-bold ${isToday ? "text-primary" : "text-gray-700"}`}>
                  {format(day, "M月d日（E）", { locale: ja })}
                  {isToday && <span className="ml-1.5 text-xs text-white bg-primary px-1.5 py-0.5 rounded-full">今日</span>}
                </span>
              </div>
              <div className="flex gap-0.5">
                {MEAL_TYPES.map((t) => {
                  const s = deriveMealStatus(mealMap[t] as Meal | undefined);
                  return (
                    <span key={t} className={`text-xs px-1 py-0.5 rounded font-bold ${s === "確認OK" ? "bg-green-100 text-green-600" : s === "要確認" ? "bg-red-100 text-red-600" : "bg-gray-100 text-gray-400"}`}>
                      {t[0]}
                    </span>
                  );
                })}
              </div>
            </div>
            <div className="px-3 py-2 flex gap-2">
              {MEAL_TYPES.map((t) => {
                const m = mealMap[t] as Meal | undefined;
                return (
                  <button
                    key={t}
                    onClick={() => m ? onEdit(m) : onNewEntry(key, t)}
                    className="flex-1 text-left hover:opacity-80 transition-opacity"
                  >
                    <MealTypeBadge type={t} meal={m} />
                  </button>
                );
              })}
            </div>
            {dayMeals.some((m) => m.notes) && (
              <div className="px-4 pb-2">
                {dayMeals.filter((m) => m.notes).map((m) => (
                  <div key={m.id} className="text-xs text-gray-500 bg-gray-50 rounded-lg px-2 py-1">
                    <span className="font-semibold text-gray-600">{m.mealType}:</span> {m.notes}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

interface YearlyViewProps {
  mealsByDate: Map<string, Meal[]>;
  year: number;
  onSelectMonth: (month: number) => void;
}
function YearlyView({ mealsByDate, year, onSelectMonth }: YearlyViewProps) {
  const months = Array.from({ length: 12 }, (_, i) => i);

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
      {months.map((m) => {
        const monthStart = startOfMonth(new Date(year, m, 1));
        const monthEnd = endOfMonth(monthStart);
        const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
        const recordedDays = days.filter((d) => {
          const key = format(d, "yyyy-MM-dd");
          const dayMeals = mealsByDate.get(key) ?? [];
          return dayMeals.length > 0;
        });
        const totalSlots = days.length * 3;
        const recordedSlots = Array.from(mealsByDate.entries())
          .filter(([key]) => {
            const d = parseISO(key);
            return getYear(d) === year && getMonth(d) === m;
          })
          .reduce((sum, [, meals]) => sum + meals.length, 0);
        const pct = totalSlots > 0 ? Math.round((recordedSlots / totalSlots) * 100) : 0;
        const isFuture = new Date(year, m, 1) > new Date();
        const isCurrent = getYear(new Date()) === year && getMonth(new Date()) === m;

        return (
          <button
            key={m}
            onClick={() => !isFuture && onSelectMonth(m)}
            disabled={isFuture}
            className={`rounded-2xl border p-4 text-left transition-all hover:shadow-sm ${
              isCurrent
                ? "border-primary/40 bg-orange-50"
                : isFuture
                ? "border-gray-100 bg-gray-50 opacity-50 cursor-not-allowed"
                : recordedDays.length > 0
                ? "border-gray-200 bg-white hover:border-orange-200"
                : "border-gray-100 bg-gray-50"
            }`}
          >
            <div className={`text-sm font-bold mb-2 ${isCurrent ? "text-primary" : "text-gray-700"}`}>
              {m + 1}月
            </div>
            {recordedDays.length > 0 ? (
              <>
                <div className="text-xs text-gray-500">{recordedDays.length}日 記録あり</div>
                <div className="mt-2 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${pct >= 80 ? "bg-green-400" : pct >= 50 ? "bg-orange-400" : "bg-red-400"}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <div className="text-xs text-gray-400 mt-0.5">{pct}% 記録率</div>
              </>
            ) : isFuture ? (
              <div className="text-xs text-gray-400">未来</div>
            ) : (
              <div className="text-xs text-gray-400">記録なし</div>
            )}
          </button>
        );
      })}
    </div>
  );
}

interface EditTarget {
  meal?: Meal;
  date?: string;
  mealType?: MealType;
}

export default function ResidentMealHistory() {
  const [, nav] = useLocation();
  const [, params] = useRoute("/meals/records/:residentId");
  const residentId = params?.residentId ? parseInt(params.residentId) : 0;

  const [viewMode, setViewMode] = useState<ViewMode>("月別");
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth());
  const [editTarget, setEditTarget] = useState<EditTarget | null>(null);

  const { data: resident } = useGetResident(residentId, { query: { enabled: !!residentId } } as never);
  const { data: allMeals = [], isLoading } = useListMeals(
    { resident_id: residentId },
    { query: { enabled: !!residentId } } as never
  );

  const mealsByDate = useMemo(() => {
    const map = new Map<string, Meal[]>();
    allMeals.forEach((m) => {
      const key = format(parseISO(m.recordedAt), "yyyy-MM-dd");
      const arr = map.get(key) ?? [];
      arr.push(m);
      map.set(key, arr);
    });
    return map;
  }, [allMeals]);

  const availableYears = useMemo(() => {
    const years = new Set<number>();
    years.add(new Date().getFullYear());
    mealsByDate.forEach((_, key) => years.add(getYear(parseISO(key))));
    return Array.from(years).sort((a, b) => b - a);
  }, [mealsByDate]);

  function prevPeriod() {
    if (viewMode === "月別") {
      if (month === 0) { setMonth(11); setYear((y) => y - 1); }
      else setMonth((m) => m - 1);
    } else {
      setYear((y) => y - 1);
    }
  }
  function nextPeriod() {
    if (viewMode === "月別") {
      if (month === 11) { setMonth(0); setYear((y) => y + 1); }
      else setMonth((m) => m + 1);
    } else {
      setYear((y) => y + 1);
    }
  }

  const canNext = viewMode === "月別"
    ? new Date(year, month + 1, 1) <= new Date()
    : year < new Date().getFullYear();

  const periodLabel = viewMode === "月別"
    ? `${year}年${month + 1}月`
    : `${year}年`;

  const monthlyMealCount = useMemo(() => {
    return Array.from(mealsByDate.entries()).filter(([key]) => {
      const d = parseISO(key);
      return getYear(d) === year && getMonth(d) === month;
    }).reduce((s, [, arr]) => s + arr.length, 0);
  }, [mealsByDate, year, month]);

  return (
    <Layout>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => nav("/meals/records")}
            className="p-2 rounded-lg border border-gray-200 text-gray-500 hover:border-orange-300 hover:text-primary transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <div className="flex-1">
            {resident ? (
              <>
                <div className="text-xs text-gray-400">{resident.roomNumber} · 食事記録</div>
                <h1 className="text-xl font-bold text-gray-800">
                  {resident.lastName} {resident.firstName}様
                </h1>
              </>
            ) : (
              <Skeleton className="h-7 w-32" />
            )}
          </div>
          <button
            onClick={() => nav("/meals")}
            className="flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-semibold text-primary border border-primary/30 hover:bg-orange-50 transition-colors"
          >
            <Utensils className="h-3.5 w-3.5" />食事入力
          </button>
        </div>

        {/* View mode + period navigator */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-3 flex items-center gap-3 flex-wrap">
          {/* View mode toggle */}
          <div className="flex rounded-xl overflow-hidden border border-gray-200 shrink-0">
            {(["月別", "年別"] as ViewMode[]).map((v) => (
              <button
                key={v}
                onClick={() => setViewMode(v)}
                className={`px-4 py-1.5 text-xs font-bold transition-colors ${
                  viewMode === v ? "bg-primary text-white" : "text-gray-600 hover:bg-gray-50"
                }`}
              >
                {v}
              </button>
            ))}
          </div>

          {/* Period navigator */}
          <div className="flex items-center gap-2 flex-1 justify-center">
            <button
              onClick={prevPeriod}
              className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:border-orange-300 hover:text-primary transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-sm font-bold text-gray-700 min-w-[100px] text-center">{periodLabel}</span>
            <button
              onClick={nextPeriod}
              disabled={!canNext}
              className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:border-orange-300 hover:text-primary transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          {viewMode === "月別" && (
            <div className="text-xs text-gray-400 shrink-0">{monthlyMealCount}件の記録</div>
          )}
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="bg-white rounded-2xl border border-gray-100 p-4">
                <Skeleton className="h-4 w-24 mb-3" />
                <div className="flex gap-2">
                  <Skeleton className="h-16 flex-1 rounded-xl" />
                  <Skeleton className="h-16 flex-1 rounded-xl" />
                  <Skeleton className="h-16 flex-1 rounded-xl" />
                </div>
              </div>
            ))}
          </div>
        ) : viewMode === "月別" ? (
          <MonthlyView
            mealsByDate={mealsByDate}
            year={year}
            month={month}
            onEdit={(meal) => setEditTarget({ meal })}
            onNewEntry={(date, mealType) => setEditTarget({ date, mealType })}
          />
        ) : (
          <YearlyView
            mealsByDate={mealsByDate}
            year={year}
            onSelectMonth={(m) => { setMonth(m); setViewMode("月別"); }}
          />
        )}
      </div>

      {editTarget && resident && (
        <MealEntryModal
          open={!!editTarget}
          onClose={() => setEditTarget(null)}
          resident={resident}
          mealType={(editTarget.meal?.mealType ?? editTarget.mealType) as MealType}
          date={editTarget.meal ? format(parseISO(editTarget.meal.recordedAt), "yyyy-MM-dd") : (editTarget.date ?? format(new Date(), "yyyy-MM-dd"))}
          existingMeal={editTarget.meal}
        />
      )}
    </Layout>
  );
}
