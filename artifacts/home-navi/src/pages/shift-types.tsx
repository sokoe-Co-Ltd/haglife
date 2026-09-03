import { useState } from "react";
import {
  useListShiftTypes, useCreateShiftType, useUpdateShiftType, useDeleteShiftType,
  getListShiftTypesQueryKey,
} from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useQueryClient } from "@tanstack/react-query";
import { AlertCircle, Clock3, Loader2, Pencil, Plus, Trash2, Users } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type ShiftTypeForm = {
  code: string;
  name: string;
  defaultStartTime: string;
  defaultEndTime: string;
  requiredStaffCount: number;
  sortOrder: number;
  color: string;
  isActive: boolean;
};

const DEFAULTS: ShiftTypeForm = {
  code: "", name: "", defaultStartTime: "", defaultEndTime: "",
  requiredStaffCount: 0, sortOrder: 0, color: "", isActive: true,
};

const COLOR_PRESETS = ["#2563EB", "#0F766E", "#B45309", "#7C3AED", "#DC2626", "#475569"];

function formatTimeRange(shiftType: any) {
  const start = shiftType.defaultStartTime;
  const end = shiftType.defaultEndTime;
  if (!start && !end) return "時刻未設定";
  const crossesMidnight = start && end && end <= start;
  return `${start ?? "?"}–${end ?? "?"}${crossesMidnight ? "（翌日）" : ""}`;
}

export default function ShiftTypesPage() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const shiftTypesQuery = useListShiftTypes();
  const shiftTypes = shiftTypesQuery.data ?? [];
  const invalidate = () => qc.invalidateQueries({ queryKey: getListShiftTypesQueryKey() });

  const createMut = useCreateShiftType({ mutation: { onSuccess: invalidate } });
  const updateMut = useUpdateShiftType({ mutation: { onSuccess: invalidate } });
  const deleteMut = useDeleteShiftType({ mutation: { onSuccess: invalidate } });

  const [editingId, setEditingId] = useState<string | null | undefined>(undefined);
  const [form, setForm] = useState<ShiftTypeForm>(DEFAULTS);

  const open = (st?: any) => {
    setForm(st ? {
      code: st.code, name: st.name,
      defaultStartTime: st.defaultStartTime ?? "",
      defaultEndTime: st.defaultEndTime ?? "",
      requiredStaffCount: st.requiredStaffCount ?? 0,
      sortOrder: st.sortOrder, color: st.color ?? "", isActive: st.isActive,
    } : DEFAULTS);
    setEditingId(st ? st.id : null);
  };

  const save = async () => {
    const payload = {
      ...form,
      defaultStartTime: form.defaultStartTime || null,
      defaultEndTime: form.defaultEndTime || null,
      color: form.color || null,
    };
    try {
      if (editingId) {
        await updateMut.mutateAsync({ id: editingId, data: payload });
      } else {
        await createMut.mutateAsync({ data: payload });
      }
      setEditingId(undefined);
      toast({ title: editingId ? "シフト種別を更新しました" : "シフト種別を追加しました" });
    } catch {
      toast({
        title: "シフト種別を保存できませんでした",
        description: "入力内容と通信状態を確認して、もう一度お試しください。",
        variant: "destructive",
      });
    }
  };

  const remove = async (st: any) => {
    if (!confirm(`「${st.name}」を削除しますか?`)) return;
    try {
      await deleteMut.mutateAsync({ id: st.id });
      toast({ title: `「${st.name}」を削除しました` });
    } catch {
      toast({
        title: "シフト種別を削除できませんでした",
        description: "使用中のシフト種別は削除できない場合があります。",
        variant: "destructive",
      });
    }
  };

  const activeCount = (shiftTypes as any[]).filter(st => st.isActive).length;
  const requiredCount = (shiftTypes as any[]).filter(st => st.isActive && (st.requiredStaffCount ?? 0) > 0).length;
  const canSave = form.code.trim().length > 0 && form.name.trim().length > 0;

  return (
    <Layout>
      <div className="space-y-4 max-w-5xl">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-800">シフト種別</h1>
            <p className="text-xs text-gray-500 mt-0.5">シフト表で使用する勤務区分・時間・必要人数を設定します</p>
          </div>
          <Button onClick={() => open()} size="sm" className="w-full sm:w-auto">
            <Plus className="mr-1.5 h-4 w-4" />
            シフト種別を追加
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-xl border border-gray-200 bg-white px-4 py-3 text-xs text-gray-500 shadow-sm">
          <span><strong className="text-base text-gray-800">{shiftTypes.length}</strong> 種類</span>
          <span><strong className="text-base text-green-700">{activeCount}</strong> 種類が有効</span>
          <span className="flex items-center gap-1.5">
            <Users className="h-4 w-4 text-primary" />
            <strong className="text-base text-gray-800">{requiredCount}</strong> 種類で不足判定
          </span>
        </div>

        {shiftTypesQuery.isLoading ? (
          <div className="rounded-xl border border-gray-200 bg-white py-14 text-center text-sm text-gray-500">
            <Loader2 className="mx-auto mb-2 h-6 w-6 animate-spin text-primary" />
            シフト種別を読み込んでいます
          </div>
        ) : shiftTypesQuery.isError ? (
          <div className="rounded-xl border border-red-200 bg-white px-4 py-12 text-center">
            <AlertCircle className="mx-auto mb-2 h-8 w-8 text-red-400" />
            <p className="font-semibold text-gray-700">シフト種別を読み込めませんでした</p>
            <p className="mt-1 text-xs text-gray-500">通信状態を確認してページを再読み込みしてください。</p>
          </div>
        ) : shiftTypes.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-300 bg-white px-4 py-14 text-center">
            <Clock3 className="mx-auto mb-2 h-8 w-8 text-gray-300" />
            <p className="font-semibold text-gray-700">シフト種別がまだありません</p>
            <p className="mt-1 text-xs text-gray-500">早番・日勤・夜勤など、最初の勤務区分を追加してください。</p>
            <Button onClick={() => open()} size="sm" className="mt-4">
              <Plus className="mr-1.5 h-4 w-4" />最初のシフト種別を追加
            </Button>
          </div>
        ) : (
          <>
            <div className="hidden overflow-hidden rounded-xl border border-gray-200 bg-white md:block">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50">
                    <TableHead>勤務区分</TableHead>
                    <TableHead className="w-52">勤務時間</TableHead>
                    <TableHead className="w-28 text-center">必要人数</TableHead>
                    <TableHead className="w-20 text-center">並び順</TableHead>
                    <TableHead className="w-20">状態</TableHead>
                    <TableHead className="w-28"><span className="sr-only">操作</span></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(shiftTypes as any[]).map((st) => (
                    <TableRow key={st.id} className={st.isActive ? "" : "bg-gray-50/60 text-gray-400"}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <span
                            className="inline-flex min-w-10 items-center justify-center rounded-md border px-2 py-1 text-xs font-bold"
                            style={{
                              backgroundColor: (st.color ?? "#64748b") + "18",
                              color: st.color ?? "#475569",
                              borderColor: (st.color ?? "#64748b") + "55",
                            }}
                          >
                            {st.code}
                          </span>
                          <div>
                            <p className="text-sm font-semibold text-gray-800">{st.name}</p>
                            <p className="mt-0.5 text-[11px] text-gray-400">シフト表では「{st.code}」と表示</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="flex items-center gap-1.5 text-sm text-gray-600">
                          <Clock3 className="h-3.5 w-3.5 text-gray-400" />{formatTimeRange(st)}
                        </span>
                      </TableCell>
                      <TableCell className="text-center">
                        {(st.requiredStaffCount ?? 0) > 0 ? (
                          <span className="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">
                            {st.requiredStaffCount}人必要
                          </span>
                        ) : <span className="text-xs text-gray-400">判定なし</span>}
                      </TableCell>
                      <TableCell className="text-center text-sm text-gray-600">{st.sortOrder}</TableCell>
                      <TableCell>
                        <span className={`rounded-full px-2 py-0.5 text-xs ${st.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                          {st.isActive ? "有効" : "無効"}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => open(st)} title="編集">
                            <Pencil className="h-4 w-4" /><span className="sr-only">{st.name}を編集</span>
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-red-600 hover:bg-red-50 hover:text-red-700" onClick={() => remove(st)} title="削除">
                            <Trash2 className="h-4 w-4" /><span className="sr-only">{st.name}を削除</span>
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="space-y-2 md:hidden">
              {(shiftTypes as any[]).map((st) => (
                <div key={st.id} className={`rounded-xl border border-gray-200 bg-white p-3 ${st.isActive ? "" : "opacity-60"}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-2.5">
                      <span
                        className="inline-flex min-w-10 shrink-0 items-center justify-center rounded-md border px-2 py-1 text-xs font-bold"
                        style={{
                          backgroundColor: (st.color ?? "#64748b") + "18",
                          color: st.color ?? "#475569",
                          borderColor: (st.color ?? "#64748b") + "55",
                        }}
                      >{st.code}</span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-gray-800">{st.name}</p>
                        <p className="mt-0.5 text-xs text-gray-500">{formatTimeRange(st)}</p>
                      </div>
                    </div>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs ${st.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                      {st.isActive ? "有効" : "無効"}
                    </span>
                  </div>
                  <div className="mt-3 flex items-center justify-between border-t border-gray-100 pt-2.5">
                    <div className="text-xs text-gray-500">
                      必要人数：<strong className="text-gray-800">{(st.requiredStaffCount ?? 0) > 0 ? `${st.requiredStaffCount}人` : "判定なし"}</strong>
                      <span className="ml-3">並び順：{st.sortOrder}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="sm" className="h-8 px-2 text-xs" onClick={() => open(st)}>
                        <Pencil className="mr-1 h-3.5 w-3.5" />編集
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-red-600" onClick={() => remove(st)}>
                        <Trash2 className="h-4 w-4" /><span className="sr-only">{st.name}を削除</span>
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        <Dialog open={editingId !== undefined} onOpenChange={(o) => !o && setEditingId(undefined)}>
          <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingId ? "シフト種別を編集" : "シフト種別を追加"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-5">
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-gray-400">シフト表での表示イメージ</p>
                <div className="flex items-center gap-3">
                  <span
                    className="inline-flex min-w-12 items-center justify-center rounded-md border px-2.5 py-1.5 text-sm font-bold"
                    style={{
                      backgroundColor: (form.color || "#64748b") + "18",
                      color: form.color || "#475569",
                      borderColor: (form.color || "#64748b") + "55",
                    }}
                  >{form.code || "例"}</span>
                  <div>
                    <p className="text-sm font-semibold text-gray-800">{form.name || "勤務区分名"}</p>
                    <p className="text-xs text-gray-500">{formatTimeRange(form)}</p>
                  </div>
                  <span className="ml-auto text-xs text-gray-500">
                    {form.requiredStaffCount > 0 ? `${form.requiredStaffCount}人必要` : "不足判定なし"}
                  </span>
                </div>
              </div>

              <section className="space-y-3">
                <p className="text-xs font-semibold text-gray-700">基本情報</p>
                <div className="grid grid-cols-[120px_1fr] gap-2">
                  <div>
                    <label htmlFor="st-code" className="mb-1 block text-xs text-gray-500">表示コード <span className="text-red-500">*</span></label>
                    <Input id="st-code" maxLength={6} value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} className="h-9 text-sm" placeholder="例：早" />
                  </div>
                  <div>
                    <label htmlFor="st-name" className="mb-1 block text-xs text-gray-500">名称 <span className="text-red-500">*</span></label>
                    <Input id="st-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="h-9 text-sm" placeholder="例：早番" />
                  </div>
                </div>
              </section>

              <section className="space-y-3 border-t border-gray-100 pt-4">
                <p className="text-xs font-semibold text-gray-700">勤務時間</p>
                <div className="grid grid-cols-2 gap-3">
                <div>
                    <label htmlFor="st-start" className="mb-1 block text-xs text-gray-500">開始時刻</label>
                    <Input id="st-start" type="time" value={form.defaultStartTime} onChange={(e) => setForm({ ...form, defaultStartTime: e.target.value })} className="h-9 text-sm" />
                </div>
                <div>
                    <label htmlFor="st-end" className="mb-1 block text-xs text-gray-500">終了時刻</label>
                    <Input id="st-end" type="time" value={form.defaultEndTime} onChange={(e) => setForm({ ...form, defaultEndTime: e.target.value })} className="h-9 text-sm" />
                </div>
              </div>
                <p className="text-[11px] text-gray-400">夜勤など終了時刻が開始時刻より早い場合は「翌日」と表示します。</p>
              </section>

              <section className="space-y-3 border-t border-gray-100 pt-4">
                <p className="text-xs font-semibold text-gray-700">配置と表示</p>
                <div className="grid grid-cols-2 gap-3">
              <div>
                    <label htmlFor="st-required" className="mb-1 block text-xs text-gray-500">1日あたりの必要人数</label>
                    <div className="relative">
                      <Input id="st-required" type="number" min={0} value={form.requiredStaffCount} onChange={(e) => setForm({ ...form, requiredStaffCount: Math.max(0, parseInt(e.target.value) || 0) })} className="h-9 pr-8 text-sm" />
                      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">人</span>
                    </div>
                    <p className="mt-1 text-[11px] text-gray-400">0人なら不足判定を行いません</p>
              </div>
                <div>
                    <label htmlFor="st-sort" className="mb-1 block text-xs text-gray-500">シフト表での並び順</label>
                    <Input id="st-sort" type="number" value={form.sortOrder} onChange={(e) => setForm({ ...form, sortOrder: parseInt(e.target.value) || 0 })} className="h-9 text-sm" />
                </div>
                </div>

                <div>
                  <label htmlFor="st-color" className="mb-1 block text-xs text-gray-500">表示色</label>
                  <div className="flex flex-wrap items-center gap-2">
                    {COLOR_PRESETS.map(color => (
                      <button
                        key={color}
                        type="button"
                        aria-label={`表示色 ${color}`}
                        aria-pressed={form.color.toUpperCase() === color}
                        onClick={() => setForm({ ...form, color })}
                        className={`h-7 w-7 rounded-full border-2 transition-transform ${form.color.toUpperCase() === color ? "scale-110 border-gray-800 ring-2 ring-gray-300" : "border-white ring-1 ring-gray-200"}`}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                    <Input id="st-color" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} className="h-9 w-28 text-xs uppercase" placeholder="#2563EB" />
                  </div>
                </div>

                <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-gray-200 p-3">
                  <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} className="mt-0.5 h-4 w-4 rounded" />
                  <span>
                    <span className="block text-sm font-semibold text-gray-800">シフト表で使用する</span>
                    <span className="mt-0.5 block text-xs text-gray-500">無効にすると過去データは残したまま、新しいシフト入力の候補から外れます。</span>
                  </span>
                </label>
              </section>
            </div>
            <DialogFooter className="gap-2 border-t border-gray-100 pt-4">
              <Button variant="outline" size="sm" onClick={() => setEditingId(undefined)}>キャンセル</Button>
              <Button size="sm" disabled={!canSave || createMut.isPending || updateMut.isPending} onClick={save}>
                {(createMut.isPending || updateMut.isPending) && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
                {editingId ? "変更を保存" : "追加する"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
