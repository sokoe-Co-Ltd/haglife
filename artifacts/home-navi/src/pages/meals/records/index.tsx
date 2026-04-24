import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { Layout } from "@/components/layout";
import { useListResidents, useListMeals } from "@workspace/api-client-react";
import type { Resident, Meal } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import {
  CheckCircle2, AlertTriangle, ChevronRight, Search, ClipboardCheck,
} from "lucide-react";
import { format } from "date-fns";
import { ja } from "date-fns/locale";

type MealType = "朝食" | "昼食" | "夕食";
type MealStatus = "未記録" | "確認OK" | "要確認";

const MEAL_TYPES: MealType[] = ["朝食", "昼食", "夕食"];

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

function MealBadge({ status, type }: { status: MealStatus; type: string }) {
  if (status === "未記録") return (
    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-bold border border-orange-300 text-orange-500">
      {type[0]}:未
    </span>
  );
  if (status === "要確認") return (
    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-xs font-bold bg-red-100 text-red-600">
      <AlertTriangle className="h-3 w-3" />{type[0]}:確
    </span>
  );
  return (
    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-xs font-bold bg-green-100 text-green-600">
      <CheckCircle2 className="h-3 w-3" />{type[0]}:OK
    </span>
  );
}

export default function MealsRecordsIndex() {
  const [, nav] = useLocation();
  const [search, setSearch] = useState("");
  const today = format(new Date(), "yyyy-MM-dd");

  const { data: residents = [], isLoading: isResidentsLoading } = useListResidents();
  const { data: meals = [], isLoading: isMealsLoading } = useListMeals({ date: today });
  const isLoading = isResidentsLoading || isMealsLoading;

  const mealMap = useMemo<Record<string, Meal>>(() => {
    const map: Record<string, Meal> = {};
    meals.forEach((m) => { map[`${m.residentId}-${m.mealType}`] = m; });
    return map;
  }, [meals]);

  const filtered = useMemo(() => {
    if (!search.trim()) return residents;
    const q = search.trim().replace(/\s+/g, "");
    return residents.filter((r) => {
      const name = `${r.lastName}${r.firstName}`;
      const nameKana = `${r.lastNameKana}${r.firstNameKana}`;
      return name.includes(q) || nameKana.includes(q) || r.roomNumber.includes(q);
    });
  }, [residents, search]);

  const todayLabel = format(new Date(), "M月d日（E）", { locale: ja });

  const recordedCount = residents.filter((r) =>
    MEAL_TYPES.every((t) => deriveMealStatus(getMeal(mealMap, r.id, t)) !== "未記録")
  ).length;

  return (
    <Layout>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => nav("/meals")}
            className="p-2 rounded-lg border border-gray-200 text-gray-500 hover:border-orange-300 hover:text-primary transition-colors"
          >
            ←
          </button>
          <div>
            <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2">
              <ClipboardCheck className="h-5 w-5 text-primary" />
              記録チェック
            </h1>
            <p className="text-xs text-gray-400">{todayLabel}の食事記録</p>
          </div>
        </div>

        {/* Summary bar */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 flex items-center gap-4 flex-wrap">
          <div className="flex-1 min-w-0">
            <div className="text-xs text-gray-500 mb-1">全食事記録済み</div>
            <div className="text-2xl font-bold text-primary">{recordedCount}<span className="text-sm font-normal text-gray-500 ml-1">/ {residents.length} 名</span></div>
          </div>
          {MEAL_TYPES.map((t) => {
            const done = residents.filter((r) => deriveMealStatus(getMeal(mealMap, r.id, t)) !== "未記録").length;
            return (
              <div key={t} className="text-center">
                <div className="text-xs text-gray-500 mb-1">{t}</div>
                <div className={`text-lg font-bold ${done === residents.length ? "text-green-600" : "text-orange-500"}`}>
                  {done}<span className="text-xs font-normal text-gray-400">/{residents.length}</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="氏名・居室番号で検索…"
            className="w-full pl-9 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-orange-300 shadow-sm"
          />
        </div>

        {/* Residents list */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          {isLoading ? (
            <div className="divide-y divide-gray-50">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 px-4 py-3">
                  <Skeleton className="h-4 w-8" />
                  <Skeleton className="h-4 w-24" />
                  <div className="ml-auto flex gap-1">
                    <Skeleton className="h-5 w-12 rounded" />
                    <Skeleton className="h-5 w-12 rounded" />
                    <Skeleton className="h-5 w-12 rounded" />
                  </div>
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-12 text-center text-gray-400 text-sm">該当する利用者がいません</div>
          ) : (
            <div className="divide-y divide-gray-50">
              {filtered.map((r) => {
                const statuses = MEAL_TYPES.map((t) => ({ t, s: deriveMealStatus(getMeal(mealMap, r.id, t)) }));
                const hasIssue = statuses.some((x) => x.s === "要確認");
                const hasUnrecorded = statuses.some((x) => x.s === "未記録");
                return (
                  <button
                    key={r.id}
                    onClick={() => nav(`/meals/records/${r.id}`)}
                    className={`w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 transition-colors ${hasIssue ? "bg-red-50/30" : ""}`}
                  >
                    <span className="text-xs text-gray-400 w-10 shrink-0">{r.roomNumber}</span>
                    <span className={`text-sm font-semibold min-w-0 flex-1 ${hasIssue ? "text-red-700" : hasUnrecorded ? "text-orange-700" : "text-gray-800"}`}>
                      {r.lastName} {r.firstName}
                    </span>
                    <div className="flex items-center gap-1 shrink-0">
                      {statuses.map(({ t, s }) => <MealBadge key={t} status={s} type={t} />)}
                    </div>
                    <ChevronRight className="h-4 w-4 text-gray-300 shrink-0" />
                  </button>
                );
              })}
            </div>
          )}
          <div className="px-4 py-2 border-t border-gray-50 text-xs text-gray-400">
            {filtered.length}名 表示中
          </div>
        </div>
      </div>
    </Layout>
  );
}
