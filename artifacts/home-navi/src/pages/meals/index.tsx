import { useState, useMemo } from "react";
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
  ChevronRight, Download, ClipboardCheck, FileSearch, Edit3, Settings2,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { format } from "date-fns";
import { DayNav } from "@/components/date-nav";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

type MealType = "朝食" | "昼食" | "夕食";
type StatusFilter = "すべて" | "未記録" | "記録済み" | "要確認";
type MealStatus = "未記録" | "確認OK" | "要確認";

const MEAL_TYPES: MealType[] = ["朝食", "昼食", "夕食"];
const STATUS_FILTERS: StatusFilter[] = ["すべて", "未記録", "記録済み", "要確認"];

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

function MealStatusCell({
  meal,
  onClick,
}: {
  meal: Meal | undefined;
  onClick?: () => void;
}) {
  const status = deriveMealStatus(meal);
  const base =
    "w-full rounded-lg py-2 px-1 transition-colors hover:bg-gray-50 active:bg-gray-100 cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/40";

  if (status === "未記録") {
    return (
      <button type="button" onClick={onClick} className={`${base} flex justify-center`}>
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold border border-orange-400 text-orange-500">未記録</span>
      </button>
    );
  }
  if (status === "要確認") {
    return (
      <button type="button" onClick={onClick} className={`${base} flex flex-col items-center gap-0.5`}>
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
    <button type="button" onClick={onClick} className={`${base} flex flex-col items-center gap-0.5`}>
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
  const history = (resident.medicalHistory ?? "").toLowerCase();
  const notes = (resident.characterNotes ?? "").toLowerCase();
  const allText = history + " " + notes;
  if (allText.includes("アレルギー") || allText.includes("allerg")) {
    alerts.push({ text: "アレルギー注意", red: true });
  }
  if (allText.includes("むせ")) {
    alerts.push({ text: "むせ注意", red: false });
  }
  if (allText.includes("嚥下")) {
    alerts.push({ text: "嚥下注意", red: true });
  }
  if (resident.stomaManagement) {
    alerts.push({ text: "ストーマ管理", red: false });
  }
  if (alerts.length === 0) return <span className="text-xs text-gray-300">特になし</span>;
  return (
    <div className="flex flex-col gap-1">
      {alerts.slice(0, 2).map((a, i) => (
        <span
          key={i}
          className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-xs font-semibold whitespace-nowrap ${
            a.red ? "bg-red-100 text-red-600" : "bg-orange-100 text-orange-600"
          }`}
        >
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
}
function QuickActionBtn({ icon: Icon, label, bg, iconBg }: QuickActionBtnProps) {
  return (
    <button className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl ${bg} hover:opacity-90 transition-opacity text-left`}>
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
}
function SidePanel({ allResidents, mealMap, floorFilter }: SidePanelProps) {
  const [memo, setMemo] = useState("");

  const baseResidents = floorFilter === "all"
    ? allResidents
    : allResidents.filter((r) => Math.floor(parseInt(r.roomNumber) / 100) === parseInt(floorFilter));

  const needsCheck = baseResidents.filter((r) =>
    MEAL_TYPES.some((t) => deriveMealStatus(getMeal(mealMap, r.id, t)) === "要確認")
  );

  return (
    <div className="w-64 shrink-0 flex flex-col gap-4">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 space-y-2">
        <h3 className="text-xs font-bold text-gray-700 mb-3">クイック操作</h3>
        <QuickActionBtn icon={Edit3} label="一括入力" bg="bg-orange-50" iconBg="bg-orange-500" />
        <QuickActionBtn icon={FileSearch} label="食事形態の確認" bg="bg-blue-50" iconBg="bg-blue-500" />
        <QuickActionBtn icon={ClipboardCheck} label="記録チェック" bg="bg-green-50" iconBg="bg-green-500" />
        <QuickActionBtn icon={Download} label="栄養エクスポート" bg="bg-purple-50" iconBg="bg-purple-500" />
      </div>

      {needsCheck.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-orange-100 p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-bold text-orange-700">
              要確認の方（{needsCheck.length}名）
            </h3>
            <button className="text-xs text-primary font-medium hover:text-primary/80">すべて見る</button>
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
                    return (
                      <span key={t} className="px-1 py-0.5 rounded text-xs font-bold bg-red-100 text-red-600">{t[0]}</span>
                    );
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
}
function MobileMealCard({ resident, mealMap, activeMealType, onEdit }: MobileMealCardProps) {
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
          return (
            <button
              key={t}
              type="button"
              onClick={() => onEdit(t)}
              className={`rounded-xl p-2 text-center cursor-pointer transition-colors hover:opacity-80 active:opacity-70 focus:outline-none focus:ring-2 focus:ring-primary/40 ${isActive ? "bg-orange-50 ring-1 ring-orange-200" : "bg-gray-50"}`}
            >
              <div className={`text-xs font-bold mb-1 ${isActive ? "text-primary" : "text-gray-500"}`}>{t[0]}</div>
              {status === "未記録" ? (
                <span className="inline-flex px-1.5 py-0.5 rounded text-xs font-bold border border-orange-400 text-orange-500">未記録</span>
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

export default function MealsList() {
  const [date, setDate] = useState(new Date());
  const [activeMealType, setActiveMealType] = useState<MealType>("昼食");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("すべて");
  const [floorFilter, setFloorFilter] = useState("all");
  const [editTarget, setEditTarget] = useState<EditTarget | null>(null);
  const dateStr = format(date, "yyyy-MM-dd");

  const openEdit = (resident: Resident, mealType: MealType) =>
    setEditTarget({ resident, mealType });

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

  const filteredResidents = useMemo<Resident[]>(() => {
    if (statusFilter === "すべて") return floorResidents;
    return floorResidents.filter((r) => {
      const status = deriveMealStatus(getMeal(mealMap, r.id, activeMealType));
      if (statusFilter === "未記録") return status === "未記録";
      if (statusFilter === "記録済み") return status === "確認OK";
      if (statusFilter === "要確認") return status === "要確認";
      return true;
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
      <div className="max-w-screen-xl mx-auto space-y-4">
        {/* Header */}
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

          {/* Meal type tabs */}
          <div className="flex items-center gap-1">
            <span className="text-xs font-semibold text-gray-500 mr-1 hidden sm:block">食事タイプ</span>
            {MEAL_TYPES.map((t) => (
              <button
                key={t}
                onClick={() => setActiveMealType(t)}
                className={`h-8 px-3 rounded-lg text-xs font-bold transition-all ${
                  activeMealType === t
                    ? "bg-primary text-white shadow-sm"
                    : "border border-gray-200 text-gray-600 hover:border-orange-300 hover:text-primary"
                }`}
              >
                {t}
              </button>
            ))}
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

          <button className="ml-auto p-2 rounded-lg border border-gray-200 text-gray-500 hover:border-orange-300 hover:text-primary transition-colors shrink-0">
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
                    <TableHead className="text-center text-xs font-bold text-gray-600 min-w-[90px]">朝食</TableHead>
                    <TableHead className="text-center text-xs font-bold text-gray-600 min-w-[90px]">昼食</TableHead>
                    <TableHead className="text-center text-xs font-bold text-gray-600 min-w-[90px]">夕食</TableHead>
                    <TableHead className="text-xs font-bold text-gray-600 min-w-[110px]">備考・アラート</TableHead>
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
                      </TableRow>
                    ))
                  ) : filteredResidents.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-12 text-gray-400 text-sm">
                        該当する利用者がいません
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredResidents.map((resident) => {
                      const needsAttn = MEAL_TYPES.some(
                        (t) => deriveMealStatus(getMeal(mealMap, resident.id, t)) === "要確認"
                      );
                      return (
                        <TableRow key={resident.id} className={`border-b border-gray-50 hover:bg-gray-50 transition-colors ${needsAttn ? "bg-red-50/30" : ""}`}>
                          <TableCell className="text-xs text-gray-400 px-3">{resident.roomNumber}</TableCell>
                          <TableCell className="text-sm font-semibold text-gray-800 whitespace-nowrap">
                            {resident.lastName} {resident.firstName}
                          </TableCell>
                          <TableCell className="py-1">
                            <MealStatusCell meal={getMeal(mealMap, resident.id, "朝食")} onClick={() => openEdit(resident, "朝食")} />
                          </TableCell>
                          <TableCell className="py-1">
                            <MealStatusCell meal={getMeal(mealMap, resident.id, "昼食")} onClick={() => openEdit(resident, "昼食")} />
                          </TableCell>
                          <TableCell className="py-1">
                            <MealStatusCell meal={getMeal(mealMap, resident.id, "夕食")} onClick={() => openEdit(resident, "夕食")} />
                          </TableCell>
                          <TableCell className="py-2">
                            <AlertColumn resident={resident} />
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
            <div className="px-4 py-2 border-t border-gray-50 text-xs text-gray-400">
              {filteredResidents.length}名 表示中
            </div>
          </div>

          <SidePanel allResidents={residents} mealMap={mealMap} floorFilter={floorFilter} />
        </div>

        {/* Mobile: card layout */}
        <div className="md:hidden space-y-3">
          {isLoading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="bg-white rounded-2xl border border-gray-100 p-4">
                <Skeleton className="h-4 w-32 mb-3" />
                <div className="grid grid-cols-3 gap-2">
                  {[0, 1, 2].map((j) => <Skeleton key={j} className="h-14 rounded-xl" />)}
                </div>
              </div>
            ))
          ) : filteredResidents.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-100 py-14 text-center text-gray-400">
              該当する利用者がいません
            </div>
          ) : (
            filteredResidents.map((resident) => (
              <MobileMealCard
                key={resident.id}
                resident={resident}
                mealMap={mealMap}
                activeMealType={activeMealType}
                onEdit={(t) => openEdit(resident, t)}
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
