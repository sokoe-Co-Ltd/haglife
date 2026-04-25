import { useState, useEffect, useMemo } from "react";
import {
  useCreateMeal,
  useUpdateMeal,
  getListMealsQueryKey,
} from "@workspace/api-client-react";
import type { Meal, Resident } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2, Check, SkipForward, Utensils } from "lucide-react";
import { isMealEnabledForResident } from "@/pages/meals/food-forms";
import { useToast } from "@/hooks/use-toast";

type MealType = "朝食" | "昼食" | "夕食";
const MEAL_TYPES: MealType[] = ["朝食", "昼食", "夕食"];
const MEAL_SHORT: Record<MealType, string> = { 朝食: "朝", 昼食: "昼", 夕食: "夕" };

const PRESETS = [
  { label: "全完食", main: 100, side: 100 },
  { label: "7割", main: 70, side: 70 },
  { label: "半量", main: 50, side: 50 },
  { label: "少量", main: 30, side: 30 },
  { label: "欠食", main: 0, side: 0 },
] as const;

interface MealDraft {
  main: number;
  side: number;
  waterOnly: boolean;
  skip: boolean;
}

function draftKey(residentId: number, mealType: MealType) {
  return `${residentId}-${mealType}`;
}

function initDraft(meal: Meal | undefined): MealDraft {
  if (!meal) return { main: 100, side: 100, waterOnly: false, skip: true };
  return {
    main: meal.mainDishPercent ?? 100,
    side: meal.sideDishPercent ?? 100,
    waterOnly: meal.waterOnly ?? false,
    skip: false,
  };
}

interface Props {
  open: boolean;
  onClose: () => void;
  residents: Resident[];
  mealMap: Record<string, Meal>;
  date: string;
  floorFilter: string;
}

export function BulkMealEntryModal({ open, onClose, residents, mealMap, date, floorFilter }: Props) {
  const queryClient = useQueryClient();
  const createMeal = useCreateMeal();
  const updateMeal = useUpdateMeal();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, MealDraft>>({});
  const [activeMealTab, setActiveMealTab] = useState<MealType>("朝食");

  const filteredResidents = useMemo(() => {
    const base = floorFilter === "all"
      ? residents
      : residents.filter((r) => Math.floor(parseInt(r.roomNumber) / 100) === parseInt(floorFilter));
    return base.slice().sort((a, b) => a.roomNumber.localeCompare(b.roomNumber, "ja"));
  }, [residents, floorFilter]);

  useEffect(() => {
    if (!open) return;
    const init: Record<string, MealDraft> = {};
    filteredResidents.forEach((r) => {
      MEAL_TYPES.forEach((t) => {
        if (!isMealEnabledForResident(r, t)) return;
        const meal = mealMap[draftKey(r.id, t)];
        init[draftKey(r.id, t)] = initDraft(meal);
      });
    });
    setDrafts(init);
  }, [open, filteredResidents, mealMap]);

  function setDraft(residentId: number, mealType: MealType, updates: Partial<MealDraft>) {
    const key = draftKey(residentId, mealType);
    setDrafts((prev) => ({
      ...prev,
      [key]: { ...prev[key], ...updates },
    }));
  }

  function applyPresetToAll(mealType: MealType, preset: typeof PRESETS[number]) {
    setDrafts((prev) => {
      const next = { ...prev };
      filteredResidents.forEach((r) => {
        if (!isMealEnabledForResident(r, mealType)) return;
        const key = draftKey(r.id, mealType);
        if (next[key]) {
          next[key] = { ...next[key], main: preset.main, side: preset.side, waterOnly: false, skip: false };
        }
      });
      return next;
    });
  }

  const pendingCount = Object.values(drafts).filter((d) => !d.skip).length;

  async function handleSave() {
    setSaving(true);
    try {
      const tasks: Promise<unknown>[] = [];
      filteredResidents.forEach((r) => {
        MEAL_TYPES.forEach((t) => {
          if (!isMealEnabledForResident(r, t)) return;
          const key = draftKey(r.id, t);
          const draft = drafts[key];
          if (!draft || draft.skip) return;
          const existingMeal = mealMap[key];
          const payload = {
            waterOnly: draft.waterOnly,
            mainDishPercent: draft.waterOnly ? null : draft.main,
            sideDishPercent: draft.waterOnly ? null : draft.side,
            waterMl: null,
            notes: null,
          };
          if (existingMeal) {
            tasks.push(
              new Promise<void>((resolve, reject) =>
                updateMeal.mutate(
                  { id: existingMeal.id, data: payload },
                  { onSuccess: () => resolve(), onError: reject }
                )
              )
            );
          } else {
            tasks.push(
              new Promise<void>((resolve, reject) =>
                createMeal.mutate(
                  {
                    data: {
                      residentId: r.id,
                      recordedAt: `${date}T00:00:00.000Z`,
                      mealType: t,
                      ...payload,
                    },
                  },
                  { onSuccess: () => resolve(), onError: reject }
                )
              )
            );
          }
        });
      });

      await Promise.allSettled(tasks);
      await queryClient.invalidateQueries({ queryKey: getListMealsQueryKey() });
      toast({ title: `${pendingCount}件の記録を保存しました` });
      onClose();
    } finally {
      setSaving(false);
    }
  }

  const tabResidents = filteredResidents.filter((r) => isMealEnabledForResident(r, activeMealTab));
  const skipCount = tabResidents.filter((r) => drafts[draftKey(r.id, activeMealTab)]?.skip).length;
  const filledCount = tabResidents.length - skipCount;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl w-full h-[92vh] flex flex-col p-0 gap-0">
        <DialogHeader className="shrink-0 px-4 pt-4 pb-0">
          <DialogTitle className="flex items-center gap-2 text-base">
            <Utensils className="h-4 w-4 text-primary" />
            一括入力
            <span className="text-sm text-gray-400 font-normal ml-1">{date}</span>
          </DialogTitle>
        </DialogHeader>

        {/* Meal type tabs */}
        <div className="shrink-0 flex gap-1 px-4 pt-3 pb-2 border-b border-gray-100">
          {MEAL_TYPES.map((t) => {
            const count = filteredResidents.filter((r) =>
              isMealEnabledForResident(r, t) && !drafts[draftKey(r.id, t)]?.skip
            ).length;
            return (
              <button
                key={t}
                type="button"
                onClick={() => setActiveMealTab(t)}
                className={`flex-1 py-2 rounded-xl text-sm font-bold transition-all ${
                  activeMealTab === t
                    ? "bg-primary text-white shadow-sm"
                    : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                }`}
              >
                {t}
                {count > 0 && (
                  <span className={`ml-1 text-xs ${activeMealTab === t ? "text-white/80" : "text-gray-400"}`}>
                    ({count})
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Bulk apply row */}
        <div className="shrink-0 px-4 py-2.5 bg-gray-50 border-b border-gray-100">
          <p className="text-xs text-gray-500 mb-2">
            全員に一括適用：
          </p>
          <div className="flex gap-1.5 flex-wrap">
            {PRESETS.map((p) => (
              <button
                key={p.label}
                type="button"
                onClick={() => applyPresetToAll(activeMealTab, p)}
                className="px-3 py-1.5 rounded-lg text-xs font-bold bg-white border border-gray-200 text-gray-600 hover:border-primary hover:text-primary hover:bg-primary/5 transition-colors"
              >
                {p.label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => {
                setDrafts((prev) => {
                  const next = { ...prev };
                  filteredResidents.forEach((r) => {
                    if (!isMealEnabledForResident(r, activeMealTab)) return;
                    const key = draftKey(r.id, activeMealTab);
                    if (next[key]) next[key] = { ...next[key], skip: true };
                  });
                  return next;
                });
              }}
              className="px-3 py-1.5 rounded-lg text-xs font-bold bg-white border border-gray-200 text-gray-400 hover:border-gray-400 hover:text-gray-600 transition-colors flex items-center gap-1"
            >
              <SkipForward className="h-3 w-3" />
              全員スキップ
            </button>
          </div>
        </div>

        {/* Resident list */}
        <div className="flex-1 overflow-y-auto divide-y divide-gray-50">
          {tabResidents.length === 0 ? (
            <div className="py-16 text-center text-sm text-gray-400">対象の利用者がいません</div>
          ) : (
            tabResidents.map((r) => {
              const key = draftKey(r.id, activeMealTab);
              const draft = drafts[key];
              if (!draft) return null;
              const existingMeal = mealMap[key];
              const existingStatus = existingMeal
                ? existingMeal.waterOnly
                  ? "水分のみ"
                  : `主${existingMeal.mainDishPercent ?? "?"}% / 副${existingMeal.sideDishPercent ?? "?"}%`
                : "未記録";

              return (
                <div
                  key={r.id}
                  className={`px-4 py-3 transition-colors ${draft.skip ? "opacity-40" : ""}`}
                >
                  {/* Resident header */}
                  <div className="flex items-center justify-between mb-2.5">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-400">{r.roomNumber}</span>
                      <span className="text-sm font-bold text-gray-800">
                        {r.lastName}{r.firstName}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-400">{existingStatus}</span>
                      <button
                        type="button"
                        onClick={() => setDraft(r.id, activeMealTab, { skip: !draft.skip })}
                        className={`text-xs font-bold px-2 py-1 rounded-lg border transition-colors ${
                          draft.skip
                            ? "border-primary/40 text-primary bg-primary/5 hover:bg-primary/10"
                            : "border-gray-200 text-gray-400 bg-gray-50 hover:border-gray-300"
                        }`}
                      >
                        {draft.skip ? "入力する" : "スキップ"}
                      </button>
                    </div>
                  </div>

                  {/* Preset buttons */}
                  {!draft.skip && (
                    <div className="space-y-2">
                      {/* Presets */}
                      <div className="flex gap-1.5">
                        {PRESETS.map((p) => {
                          const active = !draft.waterOnly && draft.main === p.main && draft.side === p.side;
                          return (
                            <button
                              key={p.label}
                              type="button"
                              onClick={() => setDraft(r.id, activeMealTab, {
                                main: p.main, side: p.side, waterOnly: false,
                              })}
                              className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${
                                active
                                  ? "bg-primary text-white shadow-sm"
                                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                              }`}
                            >
                              {p.label}
                            </button>
                          );
                        })}
                        <button
                          type="button"
                          onClick={() => setDraft(r.id, activeMealTab, { waterOnly: !draft.waterOnly })}
                          className={`px-2 py-2 rounded-lg text-xs font-bold transition-all ${
                            draft.waterOnly
                              ? "bg-blue-500 text-white shadow-sm"
                              : "bg-blue-50 text-blue-500 hover:bg-blue-100"
                          }`}
                        >
                          水分
                        </button>
                      </div>

                      {/* Detail: main/side % (only if not preset match) */}
                      {!draft.waterOnly && !PRESETS.some((p) => p.main === draft.main && p.side === draft.side) && (
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                          <span>主食</span>
                          <input
                            type="number"
                            min={0}
                            max={100}
                            value={draft.main}
                            onChange={(e) => setDraft(r.id, activeMealTab, { main: Number(e.target.value) })}
                            className="w-14 border border-gray-200 rounded px-2 py-1 text-center text-sm focus:outline-none focus:border-primary"
                          />
                          <span>%　副食</span>
                          <input
                            type="number"
                            min={0}
                            max={100}
                            value={draft.side}
                            onChange={(e) => setDraft(r.id, activeMealTab, { side: Number(e.target.value) })}
                            className="w-14 border border-gray-200 rounded px-2 py-1 text-center text-sm focus:outline-none focus:border-primary"
                          />
                          <span>%</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="shrink-0 border-t border-gray-100 px-4 py-3 bg-white">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-gray-500">
              {activeMealTab}：{filledCount}名を記録 / {skipCount}名スキップ
            </span>
            <span className="text-xs text-gray-400">
              全{pendingCount}件を保存
            </span>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="flex-1 py-3 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-colors"
            >
              キャンセル
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || pendingCount === 0}
              className="flex-1 py-3 rounded-xl bg-primary text-white text-sm font-bold hover:bg-primary/90 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              {saving ? "保存中…" : `${pendingCount}件を保存する`}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
