import { useState } from "react";
import { useLocation } from "wouter";
import { Layout } from "@/components/layout";
import {
  useListResidents,
  useUpdateResident,
  getListResidentsQueryKey,
} from "@workspace/api-client-react";
import type { Resident } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Utensils, ChevronLeft, Check, Search, Loader2,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

type MealType = "朝食" | "昼食" | "夕食";

const MEAL_TYPES: MealType[] = ["朝食", "昼食", "夕食"];

const UNSET_VALUE = "__unset__";

const TEXTURE_OPTIONS = [
  { value: UNSET_VALUE, label: "（未設定）" },
  { value: "常食", label: "常食" },
  { value: "粗きざみ食", label: "粗きざみ食" },
  { value: "きざみ食", label: "きざみ食" },
  { value: "ミキサー食", label: "ミキサー食" },
  { value: "ソフト食", label: "ソフト食" },
  { value: "流動食", label: "流動食" },
  { value: "とろみ食（薄）", label: "とろみ食（薄）" },
  { value: "とろみ食（中）", label: "とろみ食（中）" },
  { value: "とろみ食（濃）", label: "とろみ食（濃）" },
  { value: "嚥下食", label: "嚥下食" },
  { value: "水分のみ", label: "水分のみ" },
];

const TEXTURE_COLORS: Record<string, string> = {
  "常食": "bg-green-100 text-green-700",
  "粗きざみ食": "bg-lime-100 text-lime-700",
  "きざみ食": "bg-yellow-100 text-yellow-700",
  "ミキサー食": "bg-orange-100 text-orange-700",
  "ソフト食": "bg-amber-100 text-amber-700",
  "流動食": "bg-blue-100 text-blue-700",
  "とろみ食（薄）": "bg-cyan-100 text-cyan-700",
  "とろみ食（中）": "bg-sky-100 text-sky-700",
  "とろみ食（濃）": "bg-indigo-100 text-indigo-700",
  "嚥下食": "bg-purple-100 text-purple-700",
  "水分のみ": "bg-teal-100 text-teal-700",
};

function getTextureForMeal(resident: Resident, mealType: MealType): string {
  if (mealType === "朝食") return resident.mealTextureBreakfast ?? "";
  if (mealType === "昼食") return resident.mealTextureLunch ?? "";
  return resident.mealTextureDinner ?? "";
}

function TextureBadge({ value }: { value: string }) {
  if (!value) return <span className="text-xs text-gray-300">未設定</span>;
  const color = TEXTURE_COLORS[value] ?? "bg-gray-100 text-gray-600";
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${color}`}>
      {value}
    </span>
  );
}

interface TextureCellProps {
  resident: Resident;
  mealType: MealType;
  onSave: (residentId: number, mealType: MealType, value: string) => void;
  saving: boolean;
}
function TextureCell({ resident, mealType, onSave, saving }: TextureCellProps) {
  const current = getTextureForMeal(resident, mealType);
  const [open, setOpen] = useState(false);

  const selectValue = current || UNSET_VALUE;

  return (
    <Select
      value={selectValue}
      onValueChange={(v) => onSave(resident.id, mealType, v === UNSET_VALUE ? "" : v)}
      open={open}
      onOpenChange={setOpen}
    >
      <SelectTrigger className="h-8 text-xs border-0 bg-transparent hover:bg-gray-50 focus:ring-1 focus:ring-primary/30 px-1 gap-1 min-w-[100px]">
        {saving ? (
          <Loader2 className="h-3 w-3 animate-spin text-primary" />
        ) : (
          <TextureBadge value={current} />
        )}
      </SelectTrigger>
      <SelectContent>
        {TEXTURE_OPTIONS.map((opt) => (
          <SelectItem key={opt.value} value={opt.value} className="text-xs">
            <div className="flex items-center gap-2">
              {opt.value !== UNSET_VALUE ? (
                <TextureBadge value={opt.value} />
              ) : (
                <span className="text-gray-400">{opt.label}</span>
              )}
              {selectValue === opt.value && <Check className="h-3 w-3 text-primary ml-1" />}
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export default function MealFoodForms() {
  const [, nav] = useLocation();
  const [search, setSearch] = useState("");
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: residents = [], isLoading } = useListResidents();
  const updateResident = useUpdateResident();

  const filtered = residents.filter((r) => {
    if (!search.trim()) return true;
    const q = search.trim().replace(/\s+/g, "");
    const name = `${r.lastName}${r.firstName}`;
    const kana = `${r.lastNameKana}${r.firstNameKana}`;
    return name.includes(q) || kana.includes(q) || r.roomNumber.includes(q);
  });

  function handleSave(residentId: number, mealType: MealType, value: string) {
    const key = `${residentId}-${mealType}`;
    setSavingKey(key);

    const fieldMap: Record<MealType, string> = {
      "朝食": "mealTextureBreakfast",
      "昼食": "mealTextureLunch",
      "夕食": "mealTextureDinner",
    };

    updateResident.mutate(
      {
        id: residentId,
        data: { [fieldMap[mealType]]: value || null },
      },
      {
        onSuccess: () => {
          setSavingKey(null);
          queryClient.invalidateQueries({ queryKey: getListResidentsQueryKey() });
          toast({ title: `${mealType}の食事形態を更新しました` });
        },
        onError: () => {
          setSavingKey(null);
          toast({ title: "更新に失敗しました", variant: "destructive" });
        },
      }
    );
  }

  // Summary: count distinct textures
  const textureSummary = TEXTURE_OPTIONS.filter((o) => o.value !== UNSET_VALUE).map((opt) => {
    const count = residents.filter((r) =>
      [r.mealTextureBreakfast, r.mealTextureLunch, r.mealTextureDinner].includes(opt.value)
    ).length;
    return { ...opt, count };
  }).filter((o) => o.count > 0);

  return (
    <Layout>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => nav("/meals")}
            className="p-2 rounded-lg border border-gray-200 text-gray-500 hover:border-orange-300 hover:text-primary transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2">
              <Utensils className="h-5 w-5 text-primary" />
              食事形態の確認・設定
            </h1>
            <p className="text-xs text-gray-400">利用者ごとの朝・昼・夕食の食事形態を確認・変更できます</p>
          </div>
        </div>

        {/* Summary */}
        {textureSummary.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
            <h3 className="text-xs font-bold text-gray-600 mb-3">食事形態 人数サマリー（朝昼夕いずれかで使用）</h3>
            <div className="flex flex-wrap gap-2">
              {textureSummary.map((o) => (
                <div key={o.value} className="flex items-center gap-1.5">
                  <TextureBadge value={o.value} />
                  <span className="text-xs text-gray-500 font-semibold">{o.count}件</span>
                </div>
              ))}
            </div>
          </div>
        )}

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

        {/* Table */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="text-left text-xs font-bold text-gray-600 px-4 py-3 w-14">居室</th>
                  <th className="text-left text-xs font-bold text-gray-600 px-3 py-3 min-w-[110px]">氏名</th>
                  {MEAL_TYPES.map((t) => (
                    <th key={t} className="text-center text-xs font-bold text-gray-600 px-3 py-3 min-w-[130px]">
                      {t}の食事形態
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {isLoading ? (
                  Array.from({ length: 8 }).map((_, i) => (
                    <tr key={i}>
                      <td className="px-4 py-3"><Skeleton className="h-4 w-8" /></td>
                      <td className="px-3 py-3"><Skeleton className="h-4 w-24" /></td>
                      {[0, 1, 2].map((j) => (
                        <td key={j} className="px-3 py-3"><Skeleton className="h-7 w-28" /></td>
                      ))}
                    </tr>
                  ))
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center py-12 text-gray-400 text-sm">
                      該当する利用者がいません
                    </td>
                  </tr>
                ) : (
                  filtered.map((r) => {
                    const hasAnyTexture = r.mealTextureBreakfast || r.mealTextureLunch || r.mealTextureDinner;
                    return (
                      <tr key={r.id} className={`hover:bg-gray-50 transition-colors ${!hasAnyTexture ? "bg-orange-50/20" : ""}`}>
                        <td className="px-4 py-2.5 text-xs text-gray-400">{r.roomNumber}</td>
                        <td className="px-3 py-2.5">
                          <span className="text-sm font-semibold text-gray-800 whitespace-nowrap">
                            {r.lastName} {r.firstName}
                          </span>
                          {!hasAnyTexture && (
                            <span className="ml-1.5 text-xs text-orange-500 font-medium">未設定</span>
                          )}
                        </td>
                        {MEAL_TYPES.map((t) => {
                          const key = `${r.id}-${t}`;
                          return (
                            <td key={t} className="px-3 py-2 text-center">
                              <TextureCell
                                resident={r}
                                mealType={t}
                                onSave={handleSave}
                                saving={savingKey === key}
                              />
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-2 border-t border-gray-50 text-xs text-gray-400">
            {filtered.length}名 表示中 · クリックで食事形態を変更できます
          </div>
        </div>
      </div>
    </Layout>
  );
}
