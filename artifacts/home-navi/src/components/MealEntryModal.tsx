import { useState, useEffect } from "react";
import {
  useCreateMeal,
  useUpdateMeal,
  useListStaff,
  getListMealsQueryKey,
} from "@workspace/api-client-react";
import type { Meal, Resident } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CheckCircle2, Loader2, Pencil } from "lucide-react";

type MealType = "朝食" | "昼食" | "夕食";

export interface MealEntryModalProps {
  open: boolean;
  onClose: () => void;
  resident: Resident;
  mealType: MealType;
  date: string;
  existingMeal?: Meal;
}

const PERCENT_PRESETS = [0, 30, 50, 70, 100] as const;

function PercentSelector({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number | "";
  onChange: (v: number | "") => void;
}) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-semibold text-gray-700">{label}</label>
      <div className="flex items-center gap-1.5">
        {PERCENT_PRESETS.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => onChange(p)}
            className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${
              value === p
                ? "bg-primary text-white shadow-sm"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {p}%
          </button>
        ))}
        <input
          type="number"
          min={0}
          max={100}
          value={value}
          onChange={(e) =>
            onChange(e.target.value === "" ? "" : Number(e.target.value))
          }
          className="w-14 text-xs text-center border border-gray-200 rounded-lg px-1 py-2 focus:outline-none focus:border-orange-300"
          placeholder="%"
        />
      </div>
    </div>
  );
}

export function MealEntryModal({
  open,
  onClose,
  resident,
  mealType,
  date,
  existingMeal,
}: MealEntryModalProps) {
  const queryClient = useQueryClient();
  const createMeal = useCreateMeal();
  const updateMeal = useUpdateMeal();
  const { data: allStaff = [] } = useListStaff({ visible_only: true });

  const [waterOnly, setWaterOnly] = useState(false);
  const [mainDishPercent, setMainDishPercent] = useState<number | "">(100);
  const [sideDishPercent, setSideDishPercent] = useState<number | "">(100);
  const [waterMl, setWaterMl] = useState<number | "">("");
  const [medicationOk, setMedicationOk] = useState(false);
  const [medicationByStaffId, setMedicationByStaffId] = useState<string>("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (open) {
      setWaterOnly(existingMeal?.waterOnly ?? false);
      setMainDishPercent(existingMeal?.mainDishPercent ?? 100);
      setSideDishPercent(existingMeal?.sideDishPercent ?? 100);
      setWaterMl(existingMeal?.waterMl ?? "");
      setMedicationOk(existingMeal?.medicationOk ?? false);
      setMedicationByStaffId(
        existingMeal?.medicationByStaffId != null
          ? String(existingMeal.medicationByStaffId)
          : ""
      );
      setNotes(existingMeal?.notes ?? "");
    }
  }, [open, existingMeal]);

  const isPending = createMeal.isPending || updateMeal.isPending;

  const resolvedMain = mainDishPercent === "" ? null : mainDishPercent;
  const resolvedSide = sideDishPercent === "" ? null : sideDishPercent;
  const resolvedWater = waterMl === "" ? null : waterMl;

  function resolveStaffFields() {
    if (!medicationOk || !medicationByStaffId) {
      return { medicationByStaffId: null, medicationByName: null };
    }
    const staff = allStaff.find((s) => String(s.id) === medicationByStaffId);
    return {
      medicationByStaffId: staff ? staff.id : null,
      medicationByName: staff ? `${staff.lastName}${staff.firstName}` : null,
    };
  }

  const handleSubmit = () => {
    const staffFields = resolveStaffFields();

    const onSuccess = () => {
      queryClient.invalidateQueries({ queryKey: getListMealsQueryKey() });
      onClose();
    };

    if (existingMeal) {
      updateMeal.mutate(
        {
          id: existingMeal.id,
          data: {
            waterOnly,
            medicationOk,
            ...staffFields,
            mainDishPercent: waterOnly ? null : resolvedMain,
            sideDishPercent: waterOnly ? null : resolvedSide,
            waterMl: resolvedWater,
            notes: notes.trim() || null,
          },
        },
        { onSuccess }
      );
    } else {
      createMeal.mutate(
        {
          data: {
            residentId: resident.id,
            recordedAt: `${date}T00:00:00.000Z`,
            mealType,
            waterOnly,
            medicationOk,
            ...staffFields,
            mainDishPercent: waterOnly ? null : resolvedMain,
            sideDishPercent: waterOnly ? null : resolvedSide,
            waterMl: resolvedWater,
            notes: notes.trim() || null,
          },
        },
        { onSuccess }
      );
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Pencil className="h-4 w-4 text-primary" />
            <span className="text-primary font-bold">{mealType}</span>の記録
            <span className="ml-1 text-sm text-gray-500 font-normal">
              {resident.roomNumber} {resident.lastName}{resident.firstName}
            </span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-1">
          <button
            type="button"
            onClick={() => setWaterOnly((v) => !v)}
            className={`w-full flex items-center justify-between p-3 rounded-xl transition-colors ${
              waterOnly ? "bg-blue-50 border border-blue-200" : "bg-gray-50 border border-gray-200"
            }`}
          >
            <span className={`text-sm font-semibold ${waterOnly ? "text-blue-700" : "text-gray-600"}`}>
              水分のみ
            </span>
            <span
              className={`relative inline-flex h-6 w-11 rounded-full transition-colors ${
                waterOnly ? "bg-blue-500" : "bg-gray-300"
              }`}
            >
              <span
                className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                  waterOnly ? "translate-x-5" : "translate-x-0.5"
                }`}
              />
            </span>
          </button>

          {!waterOnly && (
            <>
              <PercentSelector
                label="主食割合"
                value={mainDishPercent}
                onChange={setMainDishPercent}
              />
              <PercentSelector
                label="副食割合"
                value={sideDishPercent}
                onChange={setSideDishPercent}
              />
            </>
          )}

          <div className="space-y-2">
            <label className="text-sm font-semibold text-gray-700">
              水分量{" "}
              <span className="text-gray-400 font-normal text-xs">(任意)</span>
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={0}
                value={waterMl}
                onChange={(e) =>
                  setWaterMl(e.target.value === "" ? "" : Number(e.target.value))
                }
                className="w-24 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-orange-300"
                placeholder="200"
              />
              <span className="text-xs text-gray-500">mL</span>
            </div>
          </div>

          {/* 服薬OK + 服薬者 */}
          <div className="space-y-2">
            <label className="flex items-center gap-3 p-3 bg-green-50 border border-green-100 rounded-xl cursor-pointer">
              <input
                type="checkbox"
                checked={medicationOk}
                onChange={(e) => {
                  setMedicationOk(e.target.checked);
                  if (!e.target.checked) setMedicationByStaffId("");
                }}
                className="h-4 w-4 accent-green-500"
              />
              <span className="text-sm font-semibold text-green-700">服薬OK</span>
              {medicationOk && (
                <CheckCircle2 className="h-4 w-4 text-green-500 ml-auto" />
              )}
            </label>

            {medicationOk && (
              <div className="px-1">
                <label className="text-xs font-semibold text-gray-600 mb-1 block">
                  服薬者
                </label>
                <Select
                  value={medicationByStaffId}
                  onValueChange={setMedicationByStaffId}
                >
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue placeholder="服薬者を選択" />
                  </SelectTrigger>
                  <SelectContent>
                    {allStaff.map((s) => (
                      <SelectItem key={s.id} value={String(s.id)} className="text-sm">
                        {s.lastName}{s.firstName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-gray-700">
              メモ{" "}
              <span className="text-gray-400 font-normal text-xs">(任意)</span>
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="特記事項があれば入力してください"
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-orange-300 resize-none"
            />
          </div>
        </div>

        <DialogFooter className="gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-colors"
          >
            キャンセル
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isPending}
            className="flex-1 py-2.5 rounded-xl bg-primary text-white text-sm font-bold hover:bg-primary/90 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
          >
            {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            保存する
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
