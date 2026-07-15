import { Layout } from "@/components/layout";
import {
  useGetResident, useUpdateResident,
  useGetResidentVitalThresholds, useUpdateResidentVitalThresholds,
  useGetVitalThresholds,
  useListServicesByResident, useListServiceTypes, useListShiftTypes,
  useCreateResidentService, useUpdateResidentService, useDeleteResidentService,
  getListServicesByResidentQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronLeft, User, Phone, Home, FileText, Pencil, Save, X, Stethoscope, Building2, Activity, RotateCcw } from "lucide-react";
import { ResidentAvatar } from "@/components/ResidentAvatar";
import { ResidentDayServiceCard } from "@/components/ResidentDayServiceCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Link, useParams, useSearch } from "wouter";
import { format } from "date-fns";
import { ja } from "date-fns/locale";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { ClipboardList, Plus, Trash2 } from "lucide-react";

const CARE_LEVELS = ["支1","支2","介1","介2","介3","介4","介5","新規申請中","区分変更中"];
const GENDERS = ["男性","女性"];
const BIRTH_ERAS = ["大正","昭和","平成","令和"];

// ── バイタル基準値カード ──────────────────────────────────────────────────────
const DEFAULT_THRESHOLDS = {
  temperature: { min: 35.8, max: 37.4 },
  bpSystolic:  { min: 90,   max: 159  },
  bpDiastolic: { min: 60,   max: 99   },
  pulse:       { min: 50,   max: 100  },
  spo2:        { min: 95,   max: 100  },
};
const THRESHOLD_LABELS = {
  temperature: { label: "体温 (KT)",    unit: "°C",   step: "0.1" },
  bpSystolic:  { label: "血圧 上 (BP)", unit: "mmHg", step: "1"   },
  bpDiastolic: { label: "血圧 下",      unit: "mmHg", step: "1"   },
  pulse:       { label: "脈拍 (P)",     unit: "bpm",  step: "1"   },
  spo2:        { label: "SpO2",         unit: "%",    step: "1"   },
};
type ThresholdKey = keyof typeof DEFAULT_THRESHOLDS;
type ThresholdForm = { [K in ThresholdKey]: { min: string; max: string } };

function toThresholdForm(data: typeof DEFAULT_THRESHOLDS): ThresholdForm {
  return Object.fromEntries(
    Object.entries(data).map(([k, v]) => [k, { min: String(v.min), max: String(v.max) }])
  ) as ThresholdForm;
}

const WEEKDAY_LABELS = ["日", "月", "火", "水", "木", "金", "土"];

type ServiceForm = {
  serviceTypeId: string;
  defaultStartTime: string;
  defaultDurationMinutes: number;
  weekdays: number[];
  preferredShiftTypeId: string;
  notes: string;
  effectiveFrom: string;
};

function emptyServiceForm(): ServiceForm {
  return {
    serviceTypeId: "",
    defaultStartTime: "09:00",
    defaultDurationMinutes: 60,
    weekdays: [],
    preferredShiftTypeId: "",
    notes: "",
    effectiveFrom: new Date().toISOString().slice(0, 10),
  };
}

function ResidentServicesCard({ residentId }: { residentId: number }) {
  const qc = useQueryClient();
  const { data: services = [] } = useListServicesByResident(residentId, { query: { enabled: !!residentId } });
  const { data: serviceTypes = [] } = useListServiceTypes();
  const { data: shiftTypes = [] } = useListShiftTypes();

  const invalidate = () => qc.invalidateQueries({ queryKey: getListServicesByResidentQueryKey(residentId) });
  const createMut = useCreateResidentService({ mutation: { onSuccess: invalidate } });
  const updateMut = useUpdateResidentService({ mutation: { onSuccess: invalidate } });
  const deleteMut = useDeleteResidentService({ mutation: { onSuccess: invalidate } });

  const [editingId, setEditingId] = useState<string | null | undefined>(undefined);
  const [form, setForm] = useState<ServiceForm>(emptyServiceForm());

  const open = (svc?: any) => {
    setForm(svc ? {
      serviceTypeId: svc.serviceTypeId,
      defaultStartTime: svc.defaultStartTime,
      defaultDurationMinutes: svc.defaultDurationMinutes,
      weekdays: svc.weekdays ?? [],
      preferredShiftTypeId: svc.preferredShiftTypeId ?? "",
      notes: svc.notes ?? "",
      effectiveFrom: svc.effectiveFrom,
    } : emptyServiceForm());
    setEditingId(svc ? svc.id : null);
  };

  const toggleWeekday = (d: number) => {
    setForm((f) => ({
      ...f,
      weekdays: f.weekdays.includes(d) ? f.weekdays.filter((x) => x !== d) : [...f.weekdays, d].sort(),
    }));
  };

  const save = async () => {
    const payload: any = {
      ...form,
      preferredShiftTypeId: form.preferredShiftTypeId || null,
      notes: form.notes || null,
      residentId,
    };
    if (editingId) {
      await updateMut.mutateAsync({ id: editingId, data: payload });
    } else {
      await createMut.mutateAsync({ data: payload });
    }
    setEditingId(undefined);
  };

  const terminate = async (svc: any) => {
    if (!confirm(`「${svc.serviceTypeId}」のサービスを終了しますか?`)) return;
    await deleteMut.mutateAsync({ id: svc.id });
  };

  const activeServices = (services as any[]).filter((s) => !s.terminatedAt);
  const pastServices = (services as any[]).filter((s) => s.terminatedAt);

  return (
    <>
      <Card>
        <CardHeader className="py-3 px-4 border-b flex flex-row items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <ClipboardList className="h-4 w-4 text-primary" />サービス契約
          </CardTitle>
          <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => open()}>
            <Plus className="h-3 w-3 mr-1" />追加
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          {activeServices.length === 0 ? (
            <div className="text-center py-6 text-sm text-gray-400">サービス契約がありません</div>
          ) : (
            <div className="divide-y">
              {activeServices.map((svc: any) => {
                const st = (serviceTypes as any[]).find((t) => t.id === svc.serviceTypeId);
                const shiftType = (shiftTypes as any[]).find((t) => t.id === svc.preferredShiftTypeId);
                return (
                  <div key={svc.id} className="px-4 py-3 flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        {st && (
                          <span
                            className="px-2 py-0.5 rounded text-xs font-bold"
                            style={{ background: (st.color ?? "#888") + "22", color: st.color ?? "#555", border: `1px solid ${(st.color ?? "#888")}44` }}
                          >
                            {st.shortLabel}
                          </span>
                        )}
                        <span className="text-sm font-medium">{st?.name ?? svc.serviceTypeId}</span>
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-gray-500 flex-wrap">
                        <span>{svc.defaultStartTime} ({svc.defaultDurationMinutes}分)</span>
                        <span>{(svc.weekdays ?? []).map((d: number) => WEEKDAY_LABELS[d]).join("・")}曜日</span>
                        {shiftType && <span className="text-gray-400">{shiftType.name}希望</span>}
                        <span className="text-gray-400">{svc.effectiveFrom}〜</span>
                      </div>
                      {svc.notes && <p className="text-xs text-gray-400 mt-0.5">{svc.notes}</p>}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => open(svc)}>編集</Button>
                      <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-red-500 hover:text-red-600 hover:bg-red-50" onClick={() => terminate(svc)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          {pastServices.length > 0 && (
            <div className="px-4 py-2 border-t bg-gray-50">
              <p className="text-xs text-gray-400">終了済: {pastServices.length}件</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={editingId !== undefined} onOpenChange={(o) => !o && setEditingId(undefined)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{editingId ? "サービス契約を編集" : "サービス契約を追加"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">サービス種別 <span className="text-red-500">*</span></label>
              <Select value={form.serviceTypeId} onValueChange={(v) => setForm({ ...form, serviceTypeId: v })}>
                <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="選択..." /></SelectTrigger>
                <SelectContent>
                  {(serviceTypes as any[]).map((st) => (
                    <SelectItem key={st.id} value={st.id}>{st.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">開始時刻 <span className="text-red-500">*</span></label>
                <Input value={form.defaultStartTime} onChange={(e) => setForm({ ...form, defaultStartTime: e.target.value })} className="h-8 text-sm" placeholder="09:00" />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">所要時間（分）</label>
                <Input type="number" value={form.defaultDurationMinutes} onChange={(e) => setForm({ ...form, defaultDurationMinutes: parseInt(e.target.value) || 60 })} className="h-8 text-sm" />
              </div>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">実施曜日</label>
              <div className="flex gap-1 flex-wrap">
                {WEEKDAY_LABELS.map((label, d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => toggleWeekday(d)}
                    className={`h-8 w-8 rounded-full text-xs font-bold transition-colors ${
                      form.weekdays.includes(d)
                        ? d === 0 ? "bg-red-500 text-white" : d === 6 ? "bg-blue-500 text-white" : "bg-primary text-white"
                        : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">希望シフト</label>
              <Select value={form.preferredShiftTypeId || "__none__"} onValueChange={(v) => setForm({ ...form, preferredShiftTypeId: v === "__none__" ? "" : v })}>
                <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="指定なし" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">指定なし</SelectItem>
                  {(shiftTypes as any[]).filter((t) => t.isActive).map((st) => (
                    <SelectItem key={st.id} value={st.id}>{st.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">開始日 <span className="text-red-500">*</span></label>
              <Input type="date" value={form.effectiveFrom} onChange={(e) => setForm({ ...form, effectiveFrom: e.target.value })} className="h-8 text-sm" />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">メモ</label>
              <Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="h-8 text-sm" placeholder="備考など" />
            </div>
          </div>
          <DialogFooter className="gap-2 pt-1">
            <Button variant="outline" size="sm" onClick={() => setEditingId(undefined)}>キャンセル</Button>
            <Button size="sm" disabled={createMut.isPending || updateMut.isPending || !form.serviceTypeId || !form.effectiveFrom} onClick={save}>保存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function VitalThresholdsCard({ residentId }: { residentId: number }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: globalThresholds } = useGetVitalThresholds();
  const { data: residentThresholds, isLoading } = useGetResidentVitalThresholds(residentId, {
    query: { enabled: !!residentId },
  });
  const updateMutation = useUpdateResidentVitalThresholds();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<ThresholdForm>(toThresholdForm(DEFAULT_THRESHOLDS));

  const hasCustom = residentThresholds != null;
  const effectiveThresholds = (residentThresholds ?? globalThresholds ?? DEFAULT_THRESHOLDS) as typeof DEFAULT_THRESHOLDS;

  useEffect(() => {
    if (editing) {
      setForm(toThresholdForm(effectiveThresholds));
    }
  }, [editing, residentThresholds, globalThresholds]);

  function handleSave() {
    const body = Object.fromEntries(
      (Object.keys(THRESHOLD_LABELS) as ThresholdKey[]).map((k) => [
        k,
        { min: parseFloat(form[k].min), max: parseFloat(form[k].max) },
      ])
    ) as typeof DEFAULT_THRESHOLDS;
    for (const [key, val] of Object.entries(body)) {
      if (isNaN(val.min) || isNaN(val.max) || val.min >= val.max) {
        toast({ title: `${THRESHOLD_LABELS[key as ThresholdKey]?.label ?? key}の値が不正です（最小 < 最大）`, variant: "destructive" });
        return;
      }
    }
    updateMutation.mutate(
      { id: residentId, data: body },
      {
        onSuccess: () => {
          toast({ title: "基準値を保存しました" });
          setEditing(false);
          queryClient.invalidateQueries({ queryKey: [`/api/residents/${residentId}/vital-thresholds`] });
        },
        onError: () => toast({ title: "保存に失敗しました", variant: "destructive" }),
      }
    );
  }

  function handleReset() {
    updateMutation.mutate(
      { id: residentId, data: null as any },
      {
        onSuccess: () => {
          toast({ title: "施設デフォルトに戻しました" });
          setEditing(false);
          queryClient.invalidateQueries({ queryKey: [`/api/residents/${residentId}/vital-thresholds`] });
        },
        onError: () => toast({ title: "リセットに失敗しました", variant: "destructive" }),
      }
    );
  }

  return (
    <Card>
      <CardHeader className="py-3 px-4 border-b">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary" />バイタル基準値
            {!isLoading && (
              <span className={`text-xs font-normal px-2 py-0.5 rounded-full ${hasCustom ? "bg-primary/10 text-primary" : "bg-gray-100 text-gray-500"}`}>
                {hasCustom ? "個別設定" : "施設デフォルト"}
              </span>
            )}
          </CardTitle>
          {!editing ? (
            <Button variant="ghost" size="sm" onClick={() => setEditing(true)} className="h-7 gap-1 text-xs text-muted-foreground">
              <Pencil className="h-3 w-3" />編集
            </Button>
          ) : (
            <div className="flex items-center gap-1">
              {hasCustom && (
                <Button variant="ghost" size="sm" onClick={handleReset} disabled={updateMutation.isPending} className="h-7 gap-1 text-xs text-gray-400">
                  <RotateCcw className="h-3 w-3" />デフォルトに戻す
                </Button>
              )}
              <Button variant="ghost" size="sm" onClick={() => setEditing(false)} className="h-7 text-xs text-muted-foreground">
                <X className="h-3.5 w-3.5" />
              </Button>
              <Button size="sm" onClick={handleSave} disabled={updateMutation.isPending} className="h-7 gap-1 text-xs">
                <Save className="h-3 w-3" />{updateMutation.isPending ? "保存中..." : "保存"}
              </Button>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="p-4">
        {isLoading ? (
          <div className="space-y-2">{Array.from({length:5}).map((_,i)=><Skeleton key={i} className="h-8 w-full" />)}</div>
        ) : editing ? (
          <div className="space-y-3">
            {(Object.keys(THRESHOLD_LABELS) as ThresholdKey[]).map((key) => {
              const { label, unit, step } = THRESHOLD_LABELS[key];
              return (
                <div key={key} className="grid grid-cols-[1fr_auto_1fr_auto] items-center gap-2">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">{label} 最小</p>
                    <div className="flex items-center gap-1">
                      <Input
                        type="number" step={step}
                        value={form[key].min}
                        onChange={e => setForm(prev => ({ ...prev, [key]: { ...prev[key], min: e.target.value } }))}
                        className="h-8 text-sm"
                      />
                      <span className="text-xs text-muted-foreground shrink-0">{unit}</span>
                    </div>
                  </div>
                  <span className="text-gray-300 text-sm mt-4">—</span>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">最大</p>
                    <div className="flex items-center gap-1">
                      <Input
                        type="number" step={step}
                        value={form[key].max}
                        onChange={e => setForm(prev => ({ ...prev, [key]: { ...prev[key], max: e.target.value } }))}
                        className="h-8 text-sm"
                      />
                      <span className="text-xs text-muted-foreground shrink-0">{unit}</span>
                    </div>
                  </div>
                  <div />
                </div>
              );
            })}
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {(Object.keys(THRESHOLD_LABELS) as ThresholdKey[]).map((key) => {
              const { label, unit } = THRESHOLD_LABELS[key];
              const { min, max } = effectiveThresholds[key];
              return (
                <div key={key} className="flex items-center justify-between py-2">
                  <span className="text-sm text-gray-600">{label}</span>
                  <span className="text-sm font-mono font-bold text-gray-800">
                    {min} – {max} <span className="text-xs font-normal text-gray-400">{unit}</span>
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-bold text-muted-foreground mb-1">{label}</p>
      {children}
    </div>
  );
}

function ViewText({ value, fallback = "未登録" }: { value?: string | null; fallback?: string }) {
  return <p className="text-sm whitespace-pre-wrap">{value || fallback}</p>;
}

function EditInput({ value, onChange, placeholder, type = "text", className }: {
  value: string; onChange: (v: string) => void; placeholder?: string; type?: string; className?: string;
}) {
  return (
    <Input
      type={type}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className={`h-8 text-sm ${className ?? ""}`}
    />
  );
}

function EditSelect({ value, onChange, options }: {
  value: string; onChange: (v: string) => void; options: string[];
}) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className="w-full h-8 text-sm border border-input rounded-md px-2 bg-background focus:outline-none focus:ring-2 focus:ring-ring"
    >
      {options.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  );
}

function EditTextarea({ value, onChange, placeholder, rows = 3 }: {
  value: string; onChange: (v: string) => void; placeholder?: string; rows?: number;
}) {
  return (
    <textarea
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      className="w-full text-sm border border-input rounded-md px-3 py-2 bg-background focus:outline-none focus:ring-2 focus:ring-ring resize-none"
    />
  );
}

export default function ResidentDetail() {
  const params = useParams();
  const search = useSearch();
  const id = parseInt(params.id || "0");
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const updateMutation = useUpdateResident();

  const { data: resident, isLoading } = useGetResident(id, { query: { enabled: !!id } });

  const startInEdit = new URLSearchParams(search).get("edit") === "true";
  const [editing, setEditing] = useState(startInEdit);
  const [form, setForm] = useState<Record<string, string | boolean>>({});

  useEffect(() => {
    if (resident && !editing) return;
    if (resident) {
      setForm({
        roomNumber:        resident.roomNumber ?? "",
        lastName:          resident.lastName ?? "",
        firstName:         resident.firstName ?? "",
        lastNameKana:      resident.lastNameKana ?? "",
        firstNameKana:     resident.firstNameKana ?? "",
        lastNameRoman:     resident.lastNameRoman ?? "",
        firstNameRoman:    resident.firstNameRoman ?? "",
        gender:            resident.gender ?? "女性",
        birthEra:          resident.birthEra ?? "昭和",
        birthYear:         String(resident.birthYear ?? ""),
        birthMonth:        String(resident.birthMonth ?? ""),
        birthDay:          String(resident.birthDay ?? ""),
        careLevel:         resident.careLevel ?? "介1",
        stomaManagement:   resident.stomaManagement ?? false,
        moveInDate:        resident.moveInDate ?? "",
        characterNotes:    resident.characterNotes ?? "",
        clinic1:           resident.clinic1 ?? "",
        clinic2:           resident.clinic2 ?? "",
        medicalHistory:    resident.medicalHistory ?? "",
        doctorInstructions: resident.doctorInstructions ?? "",
        keyPersonName:     resident.keyPersonName ?? "",
        keyPersonRelation: resident.keyPersonRelation ?? "",
        keyPersonTel1:     resident.keyPersonTel1 ?? "",
        keyPersonAddress:  resident.keyPersonAddress ?? "",
        keyPersonMemo:     resident.keyPersonMemo ?? "",
        careManagerCompany: resident.careManagerCompany ?? "",
        careManagerName:   resident.careManagerName ?? "",
      });
    }
  }, [resident, editing]);

  const f = (key: string) => String(form[key] ?? "");
  const set = (key: string) => (v: string | boolean) => setForm(prev => ({ ...prev, [key]: v }));

  function startEdit() {
    setEditing(true);
  }

  function cancelEdit() {
    setEditing(false);
    if (resident) {
      setForm({});
    }
  }

  function saveEdit() {
    updateMutation.mutate(
      {
        id,
        data: {
          roomNumber:        f("roomNumber") || null,
          lastName:          f("lastName") || null,
          firstName:         f("firstName") || null,
          lastNameKana:      f("lastNameKana") || null,
          firstNameKana:     f("firstNameKana") || null,
          lastNameRoman:     f("lastNameRoman") || null,
          firstNameRoman:    f("firstNameRoman") || null,
          gender:            f("gender") || null,
          birthEra:          f("birthEra") || null,
          birthYear:         f("birthYear") ? parseInt(f("birthYear")) : null,
          birthMonth:        f("birthMonth") ? parseInt(f("birthMonth")) : null,
          birthDay:          f("birthDay") ? parseInt(f("birthDay")) : null,
          careLevel:         f("careLevel") || null,
          stomaManagement:   !!form.stomaManagement,
          moveInDate:        f("moveInDate") || null,
          characterNotes:    f("characterNotes") || null,
          clinic1:           f("clinic1") || null,
          clinic2:           f("clinic2") || null,
          medicalHistory:    f("medicalHistory") || null,
          doctorInstructions: f("doctorInstructions") || null,
          keyPersonName:     f("keyPersonName") || null,
          keyPersonRelation: f("keyPersonRelation") || null,
          keyPersonTel1:     f("keyPersonTel1") || null,
          keyPersonAddress:  f("keyPersonAddress") || null,
          keyPersonMemo:     f("keyPersonMemo") || null,
          careManagerCompany: f("careManagerCompany") || null,
          careManagerName:   f("careManagerName") || null,
        },
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries();
          toast({ title: "保存しました" });
          setEditing(false);
        },
        onError: () => toast({ title: "保存に失敗しました", variant: "destructive" }),
      }
    );
  }

  return (
    <Layout>
      <div className="space-y-6 max-w-3xl mx-auto pb-24">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Link href="/residents">
              <Button variant="ghost" size="icon">
                <ChevronLeft className="h-6 w-6" />
              </Button>
            </Link>
            <h1 className="text-xl font-bold tracking-tight">利用者情報</h1>
          </div>
          <div className="flex items-center gap-2">
            {!editing ? (
              <>
                <Button variant="outline" size="sm" onClick={startEdit} className="gap-1.5">
                  <Pencil className="h-4 w-4" />編集
                </Button>
                <Link href={`/health/${id}`}>
                  <Button variant="outline" size="sm" className="text-primary border-primary">健康管理</Button>
                </Link>
              </>
            ) : (
              <>
                <Button variant="ghost" size="sm" onClick={cancelEdit} className="gap-1 text-muted-foreground">
                  <X className="h-4 w-4" />キャンセル
                </Button>
                <Button size="sm" onClick={saveEdit} disabled={updateMutation.isPending} className="gap-1.5">
                  <Save className="h-4 w-4" />
                  {updateMutation.isPending ? "保存中..." : "保存"}
                </Button>
              </>
            )}
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        ) : !resident ? (
          <div className="text-center py-12">見つかりませんでした</div>
        ) : (
          <div className="space-y-5">

            {/* ── 基本情報 ── */}
            <Card className="bg-primary/5 border-primary/20">
              <CardContent className="p-5">
                <div className="flex items-start gap-4 mb-5">
                  <ResidentAvatar resident={resident} size="xl" allowUpload />
                  {editing ? (
                    <div className="flex-1 grid grid-cols-2 gap-2">
                      <div className="col-span-2 flex gap-2">
                        <div className="flex-1">
                          <p className="text-xs text-muted-foreground mb-1">部屋番号</p>
                          <EditInput value={f("roomNumber")} onChange={set("roomNumber")} placeholder="101" />
                        </div>
                        <div className="flex-1">
                          <p className="text-xs text-muted-foreground mb-1">要介護度</p>
                          <EditSelect value={f("careLevel")} onChange={set("careLevel")} options={CARE_LEVELS} />
                        </div>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">姓</p>
                        <EditInput value={f("lastName")} onChange={set("lastName")} />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">名</p>
                        <EditInput value={f("firstName")} onChange={set("firstName")} />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">姓（かな）</p>
                        <EditInput value={f("lastNameKana")} onChange={set("lastNameKana")} />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">名（かな）</p>
                        <EditInput value={f("firstNameKana")} onChange={set("firstNameKana")} />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">姓（ローマ字）</p>
                        <EditInput value={f("lastNameRoman")} onChange={set("lastNameRoman")} />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">名（ローマ字）</p>
                        <EditInput value={f("firstNameRoman")} onChange={set("firstNameRoman")} />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">性別</p>
                        <EditSelect value={f("gender")} onChange={set("gender")} options={GENDERS} />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">排泄管理</p>
                        <label className="flex items-center gap-2 h-8 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={!!form.stomaManagement}
                            onChange={e => set("stomaManagement")(e.target.checked)}
                            className="h-4 w-4 rounded border-gray-300"
                          />
                          <span className="text-sm">あり</span>
                        </label>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">生年（元号）</p>
                        <EditSelect value={f("birthEra")} onChange={set("birthEra")} options={BIRTH_ERAS} />
                      </div>
                      <div className="flex gap-1 items-end">
                        <div className="flex-1">
                          <p className="text-xs text-muted-foreground mb-1">年</p>
                          <EditInput value={f("birthYear")} onChange={set("birthYear")} type="number" />
                        </div>
                        <div className="w-12">
                          <p className="text-xs text-muted-foreground mb-1">月</p>
                          <EditInput value={f("birthMonth")} onChange={set("birthMonth")} type="number" />
                        </div>
                        <div className="w-12">
                          <p className="text-xs text-muted-foreground mb-1">日</p>
                          <EditInput value={f("birthDay")} onChange={set("birthDay")} type="number" />
                        </div>
                      </div>
                      <div className="col-span-2">
                        <p className="text-xs text-muted-foreground mb-1">入居日</p>
                        <EditInput value={f("moveInDate")} onChange={set("moveInDate")} type="date" />
                      </div>
                    </div>
                  ) : (
                    <div className="flex-1">
                      <div className="text-sm text-muted-foreground">{resident.roomNumber}</div>
                      <h2 className="text-2xl font-bold">{resident.lastName} {resident.firstName}様</h2>
                      <div className="text-sm text-muted-foreground mt-0.5">
                        {resident.lastNameKana} {resident.firstNameKana}
                        {(resident.lastNameRoman || resident.firstNameRoman) &&
                          ` / ${resident.lastNameRoman} ${resident.firstNameRoman}`}
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm font-medium mt-2">
                        <span>{resident.gender}</span>
                        <span>{resident.birthEra}{resident.birthYear}年{resident.birthMonth}月{resident.birthDay}日</span>
                        <span>要介護度: <span className="text-primary">{resident.careLevel}</span></span>
                        {resident.stomaManagement && (
                          <span className="text-primary bg-primary/10 px-2 py-0.5 rounded text-xs">排泄管理</span>
                        )}
                      </div>
                      {resident.moveInDate && (
                        <div className="text-xs text-muted-foreground mt-1">
                          入居日: {format(new Date(resident.moveInDate), "yyyy年MM月dd日", { locale: ja })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* ── 人物像・留意点 ── */}
            <Card>
              <CardHeader className="py-3 px-4 border-b">
                <CardTitle className="text-base flex items-center gap-2">
                  <FileText className="h-4 w-4 text-primary" />人物像・留意点
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4">
                {editing ? (
                  <EditTextarea
                    value={f("characterNotes")}
                    onChange={set("characterNotes")}
                    placeholder="人物像や留意点を入力..."
                    rows={4}
                  />
                ) : (
                  <ViewText value={resident.characterNotes} fallback="未登録" />
                )}
              </CardContent>
            </Card>

            {/* ── クリニック ── */}
            <Card>
              <CardHeader className="py-3 px-4 border-b">
                <CardTitle className="text-base flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-primary" />クリニック
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-3">
                <Field label="クリニック1">
                  {editing
                    ? <EditInput value={f("clinic1")} onChange={set("clinic1")} placeholder="クリニック名" />
                    : <ViewText value={resident.clinic1} />}
                </Field>
                <Field label="クリニック2">
                  {editing
                    ? <EditInput value={f("clinic2")} onChange={set("clinic2")} placeholder="クリニック名" />
                    : <ViewText value={resident.clinic2} />}
                </Field>
              </CardContent>
            </Card>

            {/* ── キーパーソン・関係者 ── */}
            <Card>
              <CardHeader className="py-3 px-4 border-b">
                <CardTitle className="text-base flex items-center gap-2">
                  <User className="h-4 w-4 text-primary" />キーパーソン・関係者
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-3">
                {editing ? (
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="キーパーソン名">
                      <EditInput value={f("keyPersonName")} onChange={set("keyPersonName")} placeholder="氏名" />
                    </Field>
                    <Field label="続柄">
                      <EditInput value={f("keyPersonRelation")} onChange={set("keyPersonRelation")} placeholder="長男など" />
                    </Field>
                    <div className="col-span-2">
                      <Field label="電話番号">
                        <EditInput value={f("keyPersonTel1")} onChange={set("keyPersonTel1")} type="tel" placeholder="090-0000-0000" />
                      </Field>
                    </div>
                    <div className="col-span-2">
                      <Field label="住所">
                        <EditInput value={f("keyPersonAddress")} onChange={set("keyPersonAddress")} placeholder="住所" />
                      </Field>
                    </div>
                    <div className="col-span-2">
                      <Field label="メモ">
                        <EditTextarea value={f("keyPersonMemo")} onChange={set("keyPersonMemo")} placeholder="メモ" rows={2} />
                      </Field>
                    </div>
                    <div className="col-span-2 border-t pt-3">
                      <p className="text-xs font-bold text-muted-foreground mb-2">担当ケアマネジャー</p>
                      <div className="grid grid-cols-2 gap-3">
                        <Field label="事業所名">
                          <EditInput value={f("careManagerCompany")} onChange={set("careManagerCompany")} placeholder="事業所名" />
                        </Field>
                        <Field label="担当者名">
                          <EditInput value={f("careManagerName")} onChange={set("careManagerName")} placeholder="担当者名" />
                        </Field>
                      </div>
                    </div>
                  </div>
                ) : (
                  <>
                    <div>
                      <p className="text-sm font-bold text-muted-foreground mb-1">キーパーソン</p>
                      <div className="text-sm">
                        <span className="font-bold">{resident.keyPersonName || "未登録"}</span>
                        {resident.keyPersonRelation && (
                          <span className="ml-2 text-muted-foreground">（{resident.keyPersonRelation}）</span>
                        )}
                      </div>
                    </div>
                    {resident.keyPersonTel1 && (
                      <div className="flex items-center gap-2">
                        <Phone className="h-4 w-4 text-muted-foreground" />
                        <a href={`tel:${resident.keyPersonTel1}`} className="text-sm text-primary hover:underline">
                          {resident.keyPersonTel1}
                        </a>
                      </div>
                    )}
                    {resident.keyPersonAddress && (
                      <div className="flex items-start gap-2">
                        <Home className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                        <span className="text-sm">{resident.keyPersonAddress}</span>
                      </div>
                    )}
                    {resident.keyPersonMemo && (
                      <div>
                        <p className="text-sm font-bold text-muted-foreground mb-1">メモ</p>
                        <p className="text-sm whitespace-pre-wrap">{resident.keyPersonMemo}</p>
                      </div>
                    )}
                    <div className="pt-3 border-t">
                      <p className="text-sm font-bold text-muted-foreground mb-1">担当ケアマネジャー</p>
                      <p className="text-sm">
                        {[resident.careManagerCompany, resident.careManagerName].filter(Boolean).join(" ") || "未登録"}
                      </p>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            {/* ── サービス契約 ── */}
            <ResidentServicesCard residentId={id} />

            {/* ── デイサービス ── */}
            <ResidentDayServiceCard
              residentId={id}
              residentName={resident ? `${resident.lastName}${resident.firstName}` : undefined}
            />

            {/* ── バイタル基準値 ── */}
            <VitalThresholdsCard residentId={id} />

            {/* ── 医療情報 ── */}
            <Card>
              <CardHeader className="py-3 px-4 border-b">
                <CardTitle className="text-base flex items-center gap-2">
                  <Stethoscope className="h-4 w-4 text-primary" />医療情報
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-4">
                <Field label="既往歴">
                  {editing
                    ? <EditTextarea value={f("medicalHistory")} onChange={set("medicalHistory")} placeholder="既往歴を入力..." rows={4} />
                    : <ViewText value={resident.medicalHistory} fallback="なし" />}
                </Field>
                <div className="pt-3 border-t">
                  <p className="text-sm font-bold text-primary mb-1">Dr.の指示</p>
                  {editing
                    ? <EditTextarea value={f("doctorInstructions")} onChange={set("doctorInstructions")} placeholder="Dr.の指示を入力..." rows={3} />
                    : <p className="text-sm whitespace-pre-wrap bg-primary/5 p-3 rounded-md border border-primary/10">
                        {resident.doctorInstructions || "特になし"}
                      </p>}
                </div>
              </CardContent>
            </Card>

          </div>
        )}
      </div>
    </Layout>
  );
}
