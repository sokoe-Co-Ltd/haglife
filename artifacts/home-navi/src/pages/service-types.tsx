import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  useListServiceTypes,
  useCreateServiceType,
  useUpdateServiceType,
  useDeleteServiceType,
} from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useQueryClient } from "@tanstack/react-query";
import { getListServiceTypesQueryKey } from "@workspace/api-client-react";

const CATEGORIES = [
  { value: "body", label: "身体介護" },
  { value: "life", label: "生活援助" },
  { value: "bathing", label: "入浴介助" },
  { value: "toileting", label: "排泄介助" },
  { value: "accompaniment", label: "通院介助・代行" },
  { value: "meal", label: "食事介助" },
  { value: "cleaning", label: "掃除・洗濯" },
  { value: "other", label: "その他" },
] as const;

type CategoryValue = (typeof CATEGORIES)[number]["value"];

const formSchema = z.object({
  name: z.string().min(1, "必須"),
  shortLabel: z.string().min(1, "必須").max(8, "8文字以内"),
  category: z.enum(["body", "life", "bathing", "toileting", "accompaniment", "meal", "cleaning", "other"]),
  durationMinutes: z.coerce.number().int().min(5, "5分以上").max(480, "480分以内"),
  color: z.string().nullable().optional(),
  sortOrder: z.coerce.number().int().default(0),
  isActive: z.boolean().default(true),
});
type FormValues = z.infer<typeof formSchema>;

const DEFAULT_VALUES: FormValues = {
  name: "",
  shortLabel: "",
  category: "body",
  durationMinutes: 30,
  color: "",
  sortOrder: 0,
  isActive: true,
};

export default function ServiceTypesPage() {
  const qc = useQueryClient();
  const { data: serviceTypes = [] } = useListServiceTypes();
  const invalidate = () => qc.invalidateQueries({ queryKey: getListServiceTypesQueryKey() });

  const createMut = useCreateServiceType({ mutation: { onSuccess: invalidate } });
  const updateMut = useUpdateServiceType({ mutation: { onSuccess: invalidate } });
  const deleteMut = useDeleteServiceType({ mutation: { onSuccess: invalidate } });

  const [editingId, setEditingId] = useState<string | null | undefined>(undefined);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: DEFAULT_VALUES,
  });

  const openCreate = () => {
    form.reset(DEFAULT_VALUES);
    setEditingId(null);
  };

  const openEdit = (st: any) => {
    form.reset({
      name: st.name,
      shortLabel: st.shortLabel,
      category: st.category as CategoryValue,
      durationMinutes: st.durationMinutes,
      color: st.color ?? "",
      sortOrder: st.sortOrder,
      isActive: st.isActive,
    });
    setEditingId(st.id);
  };

  const onSubmit = async (values: FormValues) => {
    const payload = { ...values, color: values.color || null };
    if (editingId) {
      await updateMut.mutateAsync({ id: editingId, data: payload });
    } else {
      await createMut.mutateAsync({ data: payload });
    }
    setEditingId(undefined);
  };

  const dialogOpen = editingId !== undefined;

  return (
    <Layout>
      <div className="space-y-4 max-w-4xl">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-800">サービス種別マスタ</h1>
            <p className="text-xs text-gray-500 mt-0.5">訪問介護のサービス種別を管理します</p>
          </div>
          <Button onClick={openCreate} size="sm">＋ 新規追加</Button>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50">
                <TableHead className="w-16">略称</TableHead>
                <TableHead>名称</TableHead>
                <TableHead>カテゴリ</TableHead>
                <TableHead className="w-20">所要時間</TableHead>
                <TableHead className="w-16">状態</TableHead>
                <TableHead className="w-24"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(serviceTypes as any[]).length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-sm text-gray-400">
                    サービス種別がありません
                  </TableCell>
                </TableRow>
              )}
              {(serviceTypes as any[]).map((st) => (
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
                      {st.shortLabel}
                    </span>
                  </TableCell>
                  <TableCell className="text-sm font-medium">{st.name}</TableCell>
                  <TableCell className="text-sm text-gray-600">
                    {CATEGORIES.find((c) => c.value === st.category)?.label ?? st.category}
                  </TableCell>
                  <TableCell className="text-sm">{st.durationMinutes}分</TableCell>
                  <TableCell>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${st.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                      {st.isActive ? "有効" : "無効"}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => openEdit(st)}>
                        編集
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs text-red-600 hover:text-red-700 hover:bg-red-50"
                        onClick={() => {
                          if (confirm(`「${st.name}」を削除します。よろしいですか?`)) {
                            deleteMut.mutate({ id: st.id });
                          }
                        }}
                      >
                        削除
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <Dialog open={dialogOpen} onOpenChange={(open) => !open && setEditingId(undefined)}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>{editingId ? "サービス種別を編集" : "サービス種別を追加"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">名称 <span className="text-red-500">*</span></label>
                <Input {...form.register("name")} placeholder="身体介護30分" className="h-8 text-sm" />
                {form.formState.errors.name && (
                  <p className="text-xs text-red-500 mt-0.5">{form.formState.errors.name.message}</p>
                )}
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">略称（ガント表示用） <span className="text-red-500">*</span></label>
                <Input {...form.register("shortLabel")} placeholder="身１" maxLength={8} className="h-8 text-sm" />
                {form.formState.errors.shortLabel && (
                  <p className="text-xs text-red-500 mt-0.5">{form.formState.errors.shortLabel.message}</p>
                )}
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">カテゴリ <span className="text-red-500">*</span></label>
                <Select
                  value={form.watch("category")}
                  onValueChange={(v) => form.setValue("category", v as CategoryValue)}
                >
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => (
                      <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">所要時間（分） <span className="text-red-500">*</span></label>
                <Input
                  type="number"
                  min={5}
                  max={480}
                  step={5}
                  {...form.register("durationMinutes")}
                  className="h-8 text-sm"
                />
                {form.formState.errors.durationMinutes && (
                  <p className="text-xs text-red-500 mt-0.5">{form.formState.errors.durationMinutes.message}</p>
                )}
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">表示色（#RRGGBB）</label>
                <div className="flex items-center gap-2">
                  <Input
                    {...form.register("color")}
                    placeholder="#185FA5"
                    className="h-8 text-sm flex-1"
                  />
                  {form.watch("color") && (
                    <div
                      className="h-8 w-8 rounded border border-gray-200 shrink-0"
                      style={{ backgroundColor: form.watch("color") ?? undefined }}
                    />
                  )}
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">並び順</label>
                <Input
                  type="number"
                  step={10}
                  {...form.register("sortOrder")}
                  className="h-8 text-sm"
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isActive"
                  {...form.register("isActive")}
                  className="rounded"
                />
                <label htmlFor="isActive" className="text-sm text-gray-700">有効</label>
              </div>
              <DialogFooter className="gap-2 pt-1">
                <Button type="button" variant="outline" size="sm" onClick={() => setEditingId(undefined)}>
                  キャンセル
                </Button>
                <Button type="submit" size="sm" disabled={createMut.isPending || updateMut.isPending}>
                  保存
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
