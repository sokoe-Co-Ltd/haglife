import React, { useState, useEffect } from "react";
import { Layout } from "@/components/layout";
import { useGetVitalThresholds, useUpdateVitalThresholds } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Settings, Save, RotateCcw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const DEFAULT_THRESHOLDS = {
  temperature: { min: 35.8, max: 37.4 },
  bpSystolic:  { min: 90,   max: 159  },
  bpDiastolic: { min: 60,   max: 99   },
  pulse:       { min: 50,   max: 100  },
  spo2:        { min: 95,   max: 100  },
};

const THRESHOLD_LABELS: Record<string, { label: string; unit: string; step: string }> = {
  temperature: { label: "体温 (KT)",  unit: "°C",   step: "0.1" },
  bpSystolic:  { label: "血圧 上 (BP)", unit: "mmHg", step: "1"   },
  bpDiastolic: { label: "血圧 下",    unit: "mmHg", step: "1"   },
  pulse:       { label: "脈拍 (P)",   unit: "bpm",  step: "1"   },
  spo2:        { label: "SpO2",       unit: "%",    step: "1"   },
};

type ThresholdKey = keyof typeof DEFAULT_THRESHOLDS;

type FormState = {
  [K in ThresholdKey]: { min: string; max: string };
};

function toFormState(data: typeof DEFAULT_THRESHOLDS): FormState {
  return {
    temperature: { min: String(data.temperature.min), max: String(data.temperature.max) },
    bpSystolic:  { min: String(data.bpSystolic.min),  max: String(data.bpSystolic.max)  },
    bpDiastolic: { min: String(data.bpDiastolic.min), max: String(data.bpDiastolic.max) },
    pulse:       { min: String(data.pulse.min),       max: String(data.pulse.max)       },
    spo2:        { min: String(data.spo2.min),        max: String(data.spo2.max)        },
  };
}

export default function SettingsPage() {
  const { toast } = useToast();
  const { data: savedThresholds, isLoading } = useGetVitalThresholds();
  const updateMutation = useUpdateVitalThresholds();

  const [form, setForm] = useState<FormState>(toFormState(DEFAULT_THRESHOLDS));
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    if (savedThresholds) {
      setForm(toFormState(savedThresholds as typeof DEFAULT_THRESHOLDS));
      setIsDirty(false);
    }
  }, [savedThresholds]);

  function handleChange(key: ThresholdKey, field: "min" | "max", value: string) {
    setForm((prev) => ({
      ...prev,
      [key]: { ...prev[key], [field]: value },
    }));
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
        toast({
          title: `${THRESHOLD_LABELS[key]?.label ?? key}の値が不正です（最小 < 最大 にしてください）`,
          variant: "destructive",
        });
        return;
      }
    }

    updateMutation.mutate(
      { data: body },
      {
        onSuccess: () => {
          toast({ title: "基準値を保存しました" });
          setIsDirty(false);
        },
        onError: () => toast({ title: "保存に失敗しました", variant: "destructive" }),
      }
    );
  }

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

        <Card>
          <CardContent className="p-5 space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-gray-700">バイタル基準値</h2>
              <button
                onClick={handleReset}
                className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 transition-colors"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                デフォルトに戻す
              </button>
            </div>

            <p className="text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2.5 border border-gray-100">
              この範囲を外れた値は <span className="font-bold text-red-600">要再測定</span> として記録されます。全画面で共通の基準値が使用されます。
            </p>

            {isLoading ? (
              <div className="space-y-4">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Skeleton key={i} className="h-14 w-full" />
                ))}
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
              disabled={!isDirty || updateMutation.isPending || isLoading}
              className="w-full h-11 font-bold gap-2"
            >
              <Save className="h-4 w-4" />
              {updateMutation.isPending ? "保存中..." : "基準値を保存"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
