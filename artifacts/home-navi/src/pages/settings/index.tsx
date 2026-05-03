import React, { useState, useEffect } from "react";
import { Layout } from "@/components/layout";
import { useGetVitalThresholds, useUpdateVitalThresholds } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Settings, Save, RotateCcw, Clock, ChevronDown } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

// ── バイタル基準値 ─────────────────────────────────────────────────────────
const DEFAULT_THRESHOLDS = {
  temperature: { min: 35.8, max: 37.4 },
  bpSystolic:  { min: 90,   max: 159  },
  bpDiastolic: { min: 60,   max: 99   },
  pulse:       { min: 50,   max: 100  },
  spo2:        { min: 95,   max: 100  },
};

const THRESHOLD_LABELS: Record<string, { label: string; unit: string; step: string }> = {
  temperature: { label: "体温 (KT)",    unit: "°C",   step: "0.1" },
  bpSystolic:  { label: "血圧 上 (BP)", unit: "mmHg", step: "1"   },
  bpDiastolic: { label: "血圧 下",      unit: "mmHg", step: "1"   },
  pulse:       { label: "脈拍 (P)",     unit: "bpm",  step: "1"   },
  spo2:        { label: "SpO2",         unit: "%",    step: "1"   },
};

type ThresholdKey = keyof typeof DEFAULT_THRESHOLDS;
type FormState = { [K in ThresholdKey]: { min: string; max: string } };

function toFormState(data: typeof DEFAULT_THRESHOLDS): FormState {
  return {
    temperature: { min: String(data.temperature.min), max: String(data.temperature.max) },
    bpSystolic:  { min: String(data.bpSystolic.min),  max: String(data.bpSystolic.max)  },
    bpDiastolic: { min: String(data.bpDiastolic.min), max: String(data.bpDiastolic.max) },
    pulse:       { min: String(data.pulse.min),        max: String(data.pulse.max)       },
    spo2:        { min: String(data.spo2.min),         max: String(data.spo2.max)        },
  };
}

// ── 食事時間帯 ──────────────────────────────────────────────────────────────
type MealType = "朝食" | "昼食" | "夕食";
type MealTimeSettings = { [K in MealType]: { start: number; end: number } };

const DEFAULT_MEAL_TIMES: MealTimeSettings = {
  朝食: { start: 7,  end: 10 },
  昼食: { start: 11, end: 14 },
  夕食: { start: 17, end: 20 },
};
const MEAL_TIMES_QUERY_KEY = ["mealTimeSettings"];

export default function SettingsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // ── バイタル基準値 state ──
  const { data: savedThresholds, isLoading: isThresholdsLoading } = useGetVitalThresholds();
  const updateThresholdsMutation = useUpdateVitalThresholds();
  const [form, setForm] = useState<FormState>(toFormState(DEFAULT_THRESHOLDS));
  const [isDirty, setIsDirty] = useState(false);
  const [vitalsOpen, setVitalsOpen] = useState(true);
  const [mealTimesOpen, setMealTimesOpen] = useState(true);

  useEffect(() => {
    if (savedThresholds) {
      setForm(toFormState(savedThresholds as typeof DEFAULT_THRESHOLDS));
      setIsDirty(false);
    }
  }, [savedThresholds]);

  function handleChange(key: ThresholdKey, field: "min" | "max", value: string) {
    setForm((prev) => ({ ...prev, [key]: { ...prev[key], [field]: value } }));
    setIsDirty(true);
  }

  function handleReset() {
    setForm(toFormState(DEFAULT_THRESHOLDS));
    setIsDirty(true);
  }

  function handleSave() {
    const body = {
      temperature: { min: parseFloat(form.temperature.min), max: parseFloat(form.temperature.max) },
      bpSystolic:  { min: parseFloat(form.bpSystolic.min),  max: parseFloat(form.bpSystolic.max)  },
      bpDiastolic: { min: parseFloat(form.bpDiastolic.min), max: parseFloat(form.bpDiastolic.max) },
      pulse:       { min: parseFloat(form.pulse.min),       max: parseFloat(form.pulse.max)       },
      spo2:        { min: parseFloat(form.spo2.min),        max: parseFloat(form.spo2.max)        },
    };
    for (const [key, val] of Object.entries(body)) {
      if (isNaN(val.min) || isNaN(val.max) || val.min >= val.max) {
        toast({ title: `${THRESHOLD_LABELS[key]?.label ?? key}の値が不正です（最小 < 最大）`, variant: "destructive" });
        return;
      }
    }
    updateThresholdsMutation.mutate(
      { data: body },
      {
        onSuccess: () => { toast({ title: "基準値を保存しました" }); setIsDirty(false); },
        onError: () => toast({ title: "保存に失敗しました", variant: "destructive" }),
      }
    );
  }

  // ── 食事時間帯 state ──
  const { data: mealTimeSettings = DEFAULT_MEAL_TIMES, isLoading: isMealTimesLoading } =
    useQuery<MealTimeSettings>({
      queryKey: MEAL_TIMES_QUERY_KEY,
      queryFn: async () => {
        const res = await fetch("/api/settings/meal-times");
        if (!res.ok) return DEFAULT_MEAL_TIMES;
        return res.json();
      },
    });

  const [draftMealTimes, setDraftMealTimes] = useState<MealTimeSettings>(DEFAULT_MEAL_TIMES);
  const [isMealTimesDirty, setIsMealTimesDirty] = useState(false);

  useEffect(() => {
    if (mealTimeSettings) {
      setDraftMealTimes(mealTimeSettings);
      setIsMealTimesDirty(false);
    }
  }, [mealTimeSettings]);

  function updateMealHour(meal: MealType, field: "start" | "end", hour: number) {
    setDraftMealTimes((prev) => ({ ...prev, [meal]: { ...prev[meal], [field]: hour } }));
    setIsMealTimesDirty(true);
  }

  const saveMealTimesMutation = useMutation({
    mutationFn: async (settings: MealTimeSettings) => {
      const res = await fetch("/api/settings/meal-times", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      if (!res.ok) throw new Error("保存に失敗しました");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: MEAL_TIMES_QUERY_KEY });
      toast({ title: "食事時間帯を保存しました" });
      setIsMealTimesDirty(false);
    },
    onError: () => toast({ title: "保存に失敗しました", variant: "destructive" }),
  });

  return (
    <Layout>
      <div className="space-y-6 max-w-xl mx-auto">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 flex items-center justify-center rounded-xl bg-primary/10">
            <Settings className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-gray-800">設定</h1>
            <p className="text-xs text-gray-400">施設全体の基準値を設定します</p>
          </div>
        </div>

        {/* バイタル基準値 */}
        <Card>
          <button
            type="button"
            onClick={() => setVitalsOpen((p) => !p)}
            className="w-full flex items-center justify-between px-5 py-4 text-left"
          >
            <h2 className="font-bold text-gray-700">バイタル基準値</h2>
            <ChevronDown
              className={`h-4 w-4 text-gray-400 transition-transform duration-200 ${vitalsOpen ? "rotate-180" : ""}`}
            />
          </button>

          {vitalsOpen && (
            <CardContent className="px-5 pb-5 pt-0 space-y-5">
              <div className="flex items-center justify-between">
                <p className="text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2.5 border border-gray-100 flex-1">
                  この範囲を外れた値は <span className="font-bold text-red-600">要再測定</span> として記録されます。全画面で共通の基準値が使用されます。
                </p>
                <button
                  onClick={handleReset}
                  className="ml-3 shrink-0 flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  デフォルト
                </button>
              </div>

              {isThresholdsLoading ? (
                <div className="space-y-4">
                  {[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-14 w-full" />)}
                </div>
              ) : (
                <div className="space-y-4">
                  {(Object.keys(THRESHOLD_LABELS) as ThresholdKey[]).map((key) => {
                    const { label, unit } = THRESHOLD_LABELS[key];
                    return (
                      <div key={key} className="space-y-1.5">
                        <Label className="text-sm font-medium text-gray-700">
                          {label}
                          <span className="ml-1 text-xs text-gray-400 font-normal">({unit})</span>
                        </Label>
                        <div className="flex items-center gap-2">
                          <div className="flex-1">
                            <Label className="text-xs text-gray-400 mb-1 block">最小値（下限）</Label>
                            <Input
                              type="number"
                              step={THRESHOLD_LABELS[key].step}
                              value={form[key].min}
                              onChange={(e) => handleChange(key, "min", e.target.value)}
                              className="h-10 text-base"
                            />
                          </div>
                          <span className="text-gray-400 mt-5">〜</span>
                          <div className="flex-1">
                            <Label className="text-xs text-gray-400 mb-1 block">最大値（上限）</Label>
                            <Input
                              type="number"
                              step={THRESHOLD_LABELS[key].step}
                              value={form[key].max}
                              onChange={(e) => handleChange(key, "max", e.target.value)}
                              className="h-10 text-base"
                            />
                          </div>
                          <span className="text-gray-400 mt-5 text-xs w-8 shrink-0">{unit}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              <Button
                onClick={handleSave}
                disabled={!isDirty || updateThresholdsMutation.isPending || isThresholdsLoading}
                className="w-full h-11 font-bold gap-2"
              >
                <Save className="h-4 w-4" />
                {updateThresholdsMutation.isPending ? "保存中..." : "基準値を保存"}
              </Button>
            </CardContent>
          )}
        </Card>

        {/* 食事時間帯 */}
        <Card>
          <button
            type="button"
            onClick={() => setMealTimesOpen((p) => !p)}
            className="w-full flex items-center justify-between px-5 py-4 text-left"
          >
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-orange-500" />
              <h2 className="font-bold text-gray-700">食事時間帯</h2>
            </div>
            <ChevronDown
              className={`h-4 w-4 text-gray-400 transition-transform duration-200 ${mealTimesOpen ? "rotate-180" : ""}`}
            />
          </button>

          {mealTimesOpen && (
            <CardContent className="px-5 pb-5 pt-0 space-y-5">
              <p className="text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2.5 border border-gray-100">
                各食事の入力可能な時間帯を設定してください。この時間帯以外は当日の入力がロックされます。
              </p>

              {isMealTimesLoading ? (
                <div className="space-y-4">
                  {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full" />)}
                </div>
              ) : (
                <div className="space-y-4">
                  {(["朝食", "昼食", "夕食"] as MealType[]).map((meal) => (
                    <div key={meal} className="space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-gray-700 w-10">{meal}</span>
                        <span className="text-xs text-gray-400">
                          {draftMealTimes[meal].start}:00 〜 {draftMealTimes[meal].end}:59
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="flex-1">
                          <Label className="text-xs text-gray-500 mb-1 block">開始時刻</Label>
                          <Select
                            value={String(draftMealTimes[meal].start)}
                            onValueChange={(v) => updateMealHour(meal, "start", Number(v))}
                          >
                            <SelectTrigger className="h-10">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="max-h-48">
                              {Array.from({ length: 24 }, (_, i) => (
                                <SelectItem key={i} value={String(i)}>{i}:00</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <span className="text-gray-400 mt-4">〜</span>
                        <div className="flex-1">
                          <Label className="text-xs text-gray-500 mb-1 block">終了時刻</Label>
                          <Select
                            value={String(draftMealTimes[meal].end)}
                            onValueChange={(v) => updateMealHour(meal, "end", Number(v))}
                          >
                            <SelectTrigger className="h-10">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="max-h-48">
                              {Array.from({ length: 24 }, (_, i) => (
                                <SelectItem key={i} value={String(i)}>{i}:59</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <Button
                onClick={() => saveMealTimesMutation.mutate(draftMealTimes)}
                disabled={!isMealTimesDirty || saveMealTimesMutation.isPending || isMealTimesLoading}
                className="w-full h-11 font-bold gap-2"
              >
                <Save className="h-4 w-4" />
                {saveMealTimesMutation.isPending ? "保存中..." : "食事時間帯を保存"}
              </Button>
            </CardContent>
          )}
        </Card>
      </div>
    </Layout>
  );
}
