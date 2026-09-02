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

export default function ShiftTypesPage() {
  const qc = useQueryClient();
  const { data: shiftTypes = [] } = useListShiftTypes();
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
    if (editingId) {
      await updateMut.mutateAsync({ id: editingId, data: payload });
    } else {
      await createMut.mutateAsync({ data: payload });
    }
    setEditingId(undefined);
  };

  return (
    <Layout>
      <div className="space-y-4 max-w-3xl">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-800">シフト種別マスタ</h1>
            <p className="text-xs text-gray-500 mt-0.5">早番・遅番など勤務帯区分を管理します</p>
          </div>
          <Button onClick={() => open()} size="sm">＋ 新規追加</Button>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50">
                <TableHead className="w-20">コード</TableHead>
                <TableHead>名称</TableHead>
                <TableHead className="w-24">開始</TableHead>
                <TableHead className="w-24">終了</TableHead>
                <TableHead className="w-16">並び順</TableHead>
                <TableHead className="w-16">状態</TableHead>
                <TableHead className="w-24"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(shiftTypes as any[]).length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-sm text-gray-400">
                    シフト種別がありません
                  </TableCell>
                </TableRow>
              )}
              {(shiftTypes as any[]).map((st) => (
                <TableRow key={st.id} className={st.isActive ? "" : "opacity-50"}>
                  <TableCell>
                    <span
                      className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold"
                      style={{
                        backgroundColor: (st.color ?? "#888") + "22",
                        color: st.color ?? "#555",
                        border: `1px solid ${(st.color ?? "#888")}44`,
                      }}
                    >
                      {st.code}
                    </span>
                  </TableCell>
                  <TableCell className="text-sm font-medium">{st.name}</TableCell>
                  <TableCell className="text-sm text-gray-600">{st.defaultStartTime ?? "—"}</TableCell>
                  <TableCell className="text-sm text-gray-600">{st.defaultEndTime ?? "—"}</TableCell>
                  <TableCell className="text-sm text-right">{st.sortOrder}</TableCell>
                  <TableCell>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${st.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                      {st.isActive ? "有効" : "無効"}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => open(st)}>編集</Button>
                      <Button
                        variant="ghost" size="sm"
                        className="h-7 px-2 text-xs text-red-600 hover:text-red-700 hover:bg-red-50"
                        onClick={() => {
                          if (confirm(`「${st.name}」を削除しますか?`)) deleteMut.mutate({ id: st.id });
                        }}
                      >削除</Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <Dialog open={editingId !== undefined} onOpenChange={(o) => !o && setEditingId(undefined)}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>{editingId ? "シフト種別を編集" : "シフト種別を追加"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              {[
                { label: "コード（例: 日, 早, 夜）", key: "code" as const, required: true },
                { label: "名称", key: "name" as const, required: true },
              ].map(({ label, key, required }) => (
                <div key={key}>
                  <label className="text-xs text-gray-500 mb-1 block">{label}{required && <span className="text-red-500"> *</span>}</label>
                  <Input
                    value={form[key] as string}
                    onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                    className="h-8 text-sm"
                  />
                </div>
              ))}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">開始時刻（例: 08:30）</label>
                  <Input value={form.defaultStartTime} onChange={(e) => setForm({ ...form, defaultStartTime: e.target.value })} className="h-8 text-sm" placeholder="08:30" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">終了時刻</label>
                  <Input value={form.defaultEndTime} onChange={(e) => setForm({ ...form, defaultEndTime: e.target.value })} className="h-8 text-sm" placeholder="17:30" />
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">1日あたりの必要人数</label>
                <Input type="number" min={0} value={form.requiredStaffCount} onChange={(e) => setForm({ ...form, requiredStaffCount: Math.max(0, parseInt(e.target.value) || 0) })} className="h-8 text-sm" />
                <p className="text-[11px] text-gray-400 mt-1">0人の場合は不足判定を行いません</p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">並び順</label>
                  <Input type="number" value={form.sortOrder} onChange={(e) => setForm({ ...form, sortOrder: parseInt(e.target.value) || 0 })} className="h-8 text-sm" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">表示色</label>
                  <div className="flex items-center gap-1">
                    <Input value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} className="h-8 text-sm" placeholder="#4A90E2" />
                    {form.color && <div className="h-8 w-8 rounded border shrink-0" style={{ backgroundColor: form.color }} />}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="st-active" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} className="rounded" />
                <label htmlFor="st-active" className="text-sm text-gray-700">有効</label>
              </div>
            </div>
            <DialogFooter className="gap-2 pt-1">
              <Button variant="outline" size="sm" onClick={() => setEditingId(undefined)}>キャンセル</Button>
              <Button size="sm" disabled={createMut.isPending || updateMut.isPending} onClick={save}>保存</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
