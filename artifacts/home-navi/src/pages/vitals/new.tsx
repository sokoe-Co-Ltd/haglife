import React, { useEffect, useState } from "react";
import { Layout } from "@/components/layout";
import {
  useCreateVital,
  useUpdateVital,
  useGetResident,
  useListVitals,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ChevronLeft, AlertCircle, CheckCircle2, Pencil, RefreshCw, Clock,
} from "lucide-react";
import { Link, useParams, useLocation, useSearch } from "wouter";
import { useForm } from "react-hook-form";
import { useToast } from "@/hooks/use-toast";
import { format, subDays, parseISO } from "date-fns";
import { ja } from "date-fns/locale";

// ── Standard thresholds for Japanese elderly ───────────────────────────────
const THRESHOLDS = {
  temperature: { min: 35.8, max: 37.4, label: "体温 (KT)", unit: "°C" },
  bpSystolic:  { min: 90,   max: 159,  label: "血圧上",    unit: "mmHg" },
  bpDiastolic: { min: 60,   max: 99,   label: "血圧下",    unit: "mmHg" },
  pulse:       { min: 50,   max: 100,  label: "脈拍 (P)",  unit: "bpm" },
  spo2:        { min: 95,   max: 100,  label: "SpO2",      unit: "%" },
} as const;

type ThresholdKey = keyof typeof THRESHOLDS;

function isOut(value: number | null | undefined, key: ThresholdKey): boolean {
  if (value == null || isNaN(value)) return false;
  const { min, max } = THRESHOLDS[key];
  return value < min || value > max;
}

function autoRecheck(vals: {
  temperature?: number | null;
  bpSystolic?: number | null;
  bpDiastolic?: number | null;
  pulse?: number | null;
  spo2?: number | null;
}): boolean {
  return (
    isOut(vals.temperature, "temperature") ||
    isOut(vals.bpSystolic, "bpSystolic") ||
    isOut(vals.bpDiastolic, "bpDiastolic") ||
    isOut(vals.pulse, "pulse") ||
    isOut(vals.spo2, "spo2")
  );
}

// ── Vital value display with range color ──────────────────────────────────
function VitalValue({
  value,
  field,
  suffix = "",
}: {
  value: number | null | undefined;
  field: ThresholdKey;
  suffix?: string;
}) {
  if (value == null) return <span className="text-gray-300">—</span>;
  const out = isOut(value, field);
  return (
    <span className={`font-bold ${out ? "text-red-600" : "text-gray-800"}`}>
      {value}{suffix}
      {out && <AlertCircle className="inline h-3.5 w-3.5 ml-0.5 text-red-500" />}
    </span>
  );
}

// ── Vital input row ───────────────────────────────────────────────────────
function VitalInputRow({
  label,
  name,
  placeholder,
  step,
  field,
  register,
  watchValue,
}: {
  label: string;
  name: string;
  placeholder: string;
  step?: string;
  field: ThresholdKey;
  register: any;
  watchValue: string;
}) {
  const { min, max, unit } = THRESHOLDS[field];
  const numVal = watchValue ? parseFloat(watchValue) : null;
  const out = isOut(numVal, field);
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium">{label}</Label>
        <span className="text-xs text-gray-400">基準: {min}–{max} {unit}</span>
      </div>
      <div className="relative">
        <Input
          type="number"
          step={step}
          {...register(name)}
          placeholder={placeholder}
          className={`h-11 text-base ${out ? "border-red-300 bg-red-50 focus:border-red-400" : ""}`}
        />
        {out && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-red-600">
            基準外
          </span>
        )}
      </div>
    </div>
  );
}

// ── Past vitals history row ───────────────────────────────────────────────
function HistoryRow({ vital, onEdit }: { vital: any; onEdit?: (id: number) => void }) {
  const dateLabel = format(parseISO(vital.recordedAt), "M/d（E）HH:mm", { locale: ja });
  const fields: { key: ThresholdKey; label: string; value: number | null; suffix?: string }[] = [
    { key: "temperature", label: "KT",    value: vital.temperature,  suffix: "°C" },
    { key: "bpSystolic",  label: "BP",    value: vital.bpSystolic,   suffix: "" },
    { key: "pulse",       label: "P",     value: vital.pulse,        suffix: "" },
    { key: "spo2",        label: "SpO2",  value: vital.spo2,         suffix: "%" },
  ];
  const hasRecheck = vital.needsRecheck;
  return (
    <div className={`px-4 py-3 flex items-start justify-between gap-3 ${hasRecheck ? "bg-red-50/50" : ""}`}>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs text-gray-400">{dateLabel}</span>
          {hasRecheck && (
            <span className="text-xs font-bold text-red-600 bg-red-100 px-1.5 py-0.5 rounded">要再測定</span>
          )}
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-sm">
          {fields.map(({ key, label, value, suffix }) => (
            <span key={key}>
              <span className="text-gray-400">{label}: </span>
              <VitalValue value={value} field={key} suffix={suffix} />
              {key === "bpSystolic" && vital.bpDiastolic != null && (
                <>/<VitalValue value={vital.bpDiastolic} field="bpDiastolic" /></>
              )}
            </span>
          ))}
        </div>
        {vital.notes && <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{vital.notes}</p>}
      </div>
      {onEdit && (
        <button
          onClick={() => onEdit(vital.id)}
          className="shrink-0 h-7 w-7 flex items-center justify-center rounded-lg text-gray-300 hover:text-primary hover:bg-primary/10 transition-colors"
          title="編集"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────
export default function VitalsInput() {
  const params = useParams();
  const residentId = parseInt(params.residentId || "0");
  const search = useSearch();
  const qp = new URLSearchParams(search);
  const dateProp = qp.get("date") ?? format(new Date(), "yyyy-MM-dd");

  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [editingId, setEditingId] = useState<number | null>(null);
  const [showForm, setShowForm] = useState(false);
  const autoFilledRef = React.useRef(false);
  const formCardRef = React.useRef<HTMLDivElement>(null);

  function handleHistoryEdit(id: number) {
    autoFilledRef.current = true;
    setEditingId(id);
    setShowForm(true);
    setTimeout(() => {
      formCardRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);
  }

  const { data: resident } = useGetResident(residentId, { query: { enabled: !!residentId } });

  // All vitals for this resident (recent)
  const { data: vitals, isLoading: vitalsLoading } = useListVitals(
    { resident_id: residentId },
    { query: { enabled: !!residentId } }
  );

  const createMutation = useCreateVital();
  const updateMutation = useUpdateVital();

  // Today's vitals (matching dateProp)
  const todayVitals = vitals?.filter((v) => {
    return format(parseISO(v.recordedAt), "yyyy-MM-dd") === dateProp;
  }) ?? [];

  // Past days (excluding dateProp)
  const past7 = vitals?.filter((v) => {
    const d = format(parseISO(v.recordedAt), "yyyy-MM-dd");
    return d !== dateProp;
  }).slice(0, 14) ?? [];

  const latestToday = todayVitals[0] ?? null;
  const hasToday = todayVitals.length > 0;
  const needsRecheck = latestToday?.needsRecheck ?? false;

  // Show form always; hidden only when no record exists and user hasn't toggled
  const isFormVisible = !hasToday || needsRecheck || showForm || editingId != null;

  const form = useForm({
    defaultValues: {
      temperature: "",
      bpSystolic: "",
      bpDiastolic: "",
      pulse: "",
      spo2: "",
      notes: "",
    },
  });

  // When today's record loads for the first time: auto-enter edit mode with pre-filled values
  useEffect(() => {
    if (latestToday && !autoFilledRef.current) {
      autoFilledRef.current = true;
      setEditingId(latestToday.id);
      setShowForm(true);
      form.reset({
        temperature: latestToday.temperature?.toString() ?? "",
        bpSystolic:  latestToday.bpSystolic?.toString()  ?? "",
        bpDiastolic: latestToday.bpDiastolic?.toString() ?? "",
        pulse:        latestToday.pulse?.toString()       ?? "",
        spo2:         latestToday.spo2?.toString()        ?? "",
        notes:        latestToday.notes ?? "",
      });
    }
  }, [latestToday]);

  // Re-fill form when editingId changes (e.g. after save, or when switching entry)
  useEffect(() => {
    if (editingId != null && vitals) {
      const target = vitals.find((v) => v.id === editingId);
      if (target) {
        form.reset({
          temperature: target.temperature?.toString() ?? "",
          bpSystolic:  target.bpSystolic?.toString()  ?? "",
          bpDiastolic: target.bpDiastolic?.toString() ?? "",
          pulse:        target.pulse?.toString()       ?? "",
          spo2:         target.spo2?.toString()        ?? "",
          notes:        target.notes ?? "",
        });
      }
    } else if (editingId === null && autoFilledRef.current) {
      // User explicitly switched to "new record" mode (再測定)
      form.reset({ temperature: "", bpSystolic: "", bpDiastolic: "", pulse: "", spo2: "", notes: "" });
    }
  }, [editingId]);

  const watchedVals = {
    temperature: form.watch("temperature") ? parseFloat(form.watch("temperature")) : null,
    bpSystolic: form.watch("bpSystolic") ? parseFloat(form.watch("bpSystolic")) : null,
    bpDiastolic: form.watch("bpDiastolic") ? parseFloat(form.watch("bpDiastolic")) : null,
    pulse: form.watch("pulse") ? parseFloat(form.watch("pulse")) : null,
    spo2: form.watch("spo2") ? parseFloat(form.watch("spo2")) : null,
  };
  const autoRecheckFlag = autoRecheck(watchedVals);

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["/api/vitals"] });
    queryClient.invalidateQueries({ queryKey: ["/api/vitals/today-status"] });
  }

  const onSubmit = (values: any) => {
    const parsedVals = {
      temperature: values.temperature ? Number(values.temperature) : undefined,
      bpSystolic: values.bpSystolic ? Number(values.bpSystolic) : undefined,
      bpDiastolic: values.bpDiastolic ? Number(values.bpDiastolic) : undefined,
      pulse: values.pulse ? Number(values.pulse) : undefined,
      spo2: values.spo2 ? Number(values.spo2) : undefined,
      notes: values.notes || undefined,
    };
    const needsRecheckVal = autoRecheck(parsedVals);

    if (editingId != null) {
      updateMutation.mutate(
        { id: editingId, data: { ...parsedVals, needsRecheck: needsRecheckVal } },
        {
          onSuccess: () => {
            toast({ title: "更新しました" });
            setEditingId(null);
            setShowForm(false);
            invalidate();
          },
          onError: () => toast({ title: "エラーが発生しました", variant: "destructive" }),
        }
      );
    } else {
      createMutation.mutate(
        {
          data: {
            residentId,
            recordedAt: new Date(dateProp).toISOString(),
            ...parsedVals,
            needsRecheck: needsRecheckVal,
            isBath: false,
          },
        },
        {
          onSuccess: () => {
            toast({ title: "保存しました" });
            setShowForm(false);
            invalidate();
          },
          onError: () => toast({ title: "エラーが発生しました", variant: "destructive" }),
        }
      );
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <Layout>
      <div className="space-y-5 max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3">
          <button onClick={() => setLocation("/vitals")} className="h-9 w-9 flex items-center justify-center rounded-xl hover:bg-gray-100 transition-colors">
            <ChevronLeft className="h-5 w-5 text-gray-600" />
          </button>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-gray-800">バイタル</h1>
            <p className="text-xs text-gray-400">
              {format(new Date(dateProp), "yyyy年M月d日（E）", { locale: ja })}
            </p>
          </div>
        </div>

        {/* Resident info */}
        {resident && (
          <div className="bg-primary/5 p-4 rounded-xl border border-primary/20 flex items-center gap-3">
            <div className="h-11 w-11 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold text-lg shrink-0">
              {resident.lastName.charAt(0)}
            </div>
            <div>
              <div className="text-xs text-gray-400">{resident.roomNumber}</div>
              <div className="font-bold text-lg text-gray-800">{resident.lastName} {resident.firstName}</div>
            </div>
          </div>
        )}

        {/* ── Today's record (when exists) ───────────────────────────────── */}
        {hasToday && (
          <Card className={`border ${needsRecheck ? "border-red-200 bg-red-50/30" : "border-green-200 bg-green-50/20"}`}>
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  {needsRecheck ? (
                    <>
                      <AlertCircle className="h-5 w-5 text-red-500" />
                      <span className="font-bold text-red-600">要再測定</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-5 w-5 text-green-500" />
                      <span className="font-bold text-green-700">記録済み</span>
                    </>
                  )}
                  <span className="text-xs text-gray-400">（下のフォームで変更できます）</span>
                </div>
                {needsRecheck && (
                  <button
                    onClick={() => { autoFilledRef.current = true; setEditingId(null); setShowForm(true); }}
                    className="flex items-center gap-1.5 text-xs font-bold text-white bg-red-500 px-2.5 py-1.5 rounded-lg hover:bg-red-600 transition-colors"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    再測定（新規追加）
                  </button>
                )}
              </div>

              {/* Today's vitals grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {[
                  { label: "体温 (KT)", field: "temperature" as ThresholdKey, value: latestToday?.temperature, suffix: "°C" },
                  { label: "血圧 (BP)", field: "bpSystolic" as ThresholdKey, value: latestToday?.bpSystolic, extra: latestToday?.bpDiastolic },
                  { label: "脈拍 (P)", field: "pulse" as ThresholdKey, value: latestToday?.pulse, suffix: "bpm" },
                  { label: "SpO2", field: "spo2" as ThresholdKey, value: latestToday?.spo2, suffix: "%" },
                ].map(({ label, field, value, suffix, extra }) => (
                  <div key={field} className="bg-white rounded-xl p-3 border border-gray-100">
                    <p className="text-xs text-gray-400 mb-1">{label}</p>
                    <p className="text-2xl font-bold">
                      <VitalValue value={value} field={field} />
                      {extra != null && (
                        <><span className="text-gray-400">/</span><VitalValue value={extra} field="bpDiastolic" /></>
                      )}
                    </p>
                    {suffix && value != null && (
                      <p className="text-xs text-gray-400 mt-0.5">{suffix}</p>
                    )}
                  </div>
                ))}
              </div>

              {latestToday?.notes && (
                <p className="mt-3 text-sm text-gray-600 bg-white/80 rounded-lg px-3 py-2 border border-gray-100">
                  {latestToday.notes}
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {/* ── Re-input form ──────────────────────────────────────────────── */}
        {isFormVisible && (
          <div ref={formCardRef}><Card>
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-bold text-gray-700 flex items-center gap-2">
                  {editingId != null ? (
                    <><Pencil className="h-4 w-4 text-primary" />記録を変更</>
                  ) : needsRecheck ? (
                    <><RefreshCw className="h-4 w-4 text-red-500" />再測定記録（新規追加）</>
                  ) : (
                    "バイタル記録"
                  )}
                </h2>
              </div>

              {autoRecheckFlag && (
                <div className="mb-4 flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-3 py-2.5">
                  <AlertCircle className="h-4 w-4 text-red-500 shrink-0" />
                  <p className="text-sm font-bold text-red-600">基準値を外れています → 自動で「要再測定」に設定されます</p>
                </div>
              )}

              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <VitalInputRow
                    label="体温 (KT)"
                    name="temperature"
                    placeholder="36.5"
                    step="0.1"
                    field="temperature"
                    register={form.register}
                    watchValue={form.watch("temperature")}
                  />
                  <VitalInputRow
                    label="脈拍 (P)"
                    name="pulse"
                    placeholder="70"
                    field="pulse"
                    register={form.register}
                    watchValue={form.watch("pulse")}
                  />
                  <VitalInputRow
                    label="血圧 上 (BP)"
                    name="bpSystolic"
                    placeholder="120"
                    field="bpSystolic"
                    register={form.register}
                    watchValue={form.watch("bpSystolic")}
                  />
                  <VitalInputRow
                    label="血圧 下"
                    name="bpDiastolic"
                    placeholder="80"
                    field="bpDiastolic"
                    register={form.register}
                    watchValue={form.watch("bpDiastolic")}
                  />
                  <VitalInputRow
                    label="SpO2"
                    name="spo2"
                    placeholder="98"
                    field="spo2"
                    register={form.register}
                    watchValue={form.watch("spo2")}
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-sm font-medium">備考</Label>
                  <Textarea
                    {...form.register("notes")}
                    placeholder="特記事項があれば入力"
                    className="h-20 resize-none"
                  />
                </div>

                <Button
                  type="submit"
                  className="w-full h-11 font-bold"
                  disabled={isPending}
                >
                  {isPending ? "保存中..." : editingId != null ? "変更を保存" : "記録を保存"}
                </Button>
              </form>
            </CardContent>
          </Card></div>
        )}

        {/* 再測定ボタン: 記録済みで異常なしの場合のみ表示 */}
        {hasToday && !needsRecheck && (
          <button
            onClick={() => { autoFilledRef.current = true; setEditingId(null); setShowForm(true); }}
            className="w-full py-3 rounded-xl border-2 border-dashed border-gray-200 text-gray-500 text-sm font-medium hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            再測定（新しい記録として追加）
          </button>
        )}

        {/* ── Past 7 days history ────────────────────────────────────────── */}
        <Card>
          <CardContent className="p-0">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
              <Clock className="h-4 w-4 text-gray-400" />
              <h3 className="text-sm font-bold text-gray-700">過去の記録</h3>
              {todayVitals.length > 1 && (
                <span className="text-xs text-gray-400">（本日 {todayVitals.length}件含む）</span>
              )}
            </div>
            {vitalsLoading ? (
              <div className="divide-y divide-gray-50">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="px-4 py-3">
                    <Skeleton className="h-4 w-1/3 mb-2" />
                    <Skeleton className="h-3 w-2/3" />
                  </div>
                ))}
              </div>
            ) : (
              <>
                {/* Other records today (multiple entries) */}
                {todayVitals.length > 1 && (
                  <>
                    <div className="px-4 py-1.5 bg-gray-50 border-b border-gray-100">
                      <span className="text-xs font-bold text-gray-500">本日の記録</span>
                    </div>
                    {todayVitals.slice(1).map((v) => (
                      <div key={v.id} className="divide-y divide-gray-50">
                        <HistoryRow vital={v} onEdit={handleHistoryEdit} />
                      </div>
                    ))}
                  </>
                )}
                {/* Past days */}
                {past7.length === 0 ? (
                  <div className="py-10 text-center text-sm text-gray-400">
                    過去の記録がありません
                  </div>
                ) : (
                  <div className="divide-y divide-gray-50">
                    {past7.map((v) => (
                      <HistoryRow key={v.id} vital={v} onEdit={handleHistoryEdit} />
                    ))}
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
