import { useState } from "react";
import { Layout } from "@/components/layout";
import { useCreateWeight, useGetResident, useListWeights } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ChevronLeft, Weight, History, Pencil, X, Check, CalendarDays } from "lucide-react";
import { Link, useParams } from "wouter";
import { useForm } from "react-hook-form";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { getListWeightsQueryKey } from "@workspace/api-client-react";
import { format } from "date-fns";
import { ja } from "date-fns/locale";

function formatDate(iso: string) {
  return format(new Date(iso), "M/d（E）HH:mm", { locale: ja });
}

function groupByMonth(records: any[]): Map<string, any[]> {
  const map = new Map<string, any[]>();
  for (const r of records) {
    const key = format(new Date(r.recordedAt), "yyyy年M月", { locale: ja });
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(r);
  }
  return map;
}

function isThisMonth(isoDate: string): boolean {
  const d = new Date(isoDate);
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
}

type WeightRecord = { id: number; weightKg: number; notes: string | null; recordedAt: string };

function WeightHistoryRow({
  record,
  onEdit,
}: {
  record: WeightRecord;
  onEdit: (id: number) => void;
}) {
  return (
    <div className="flex items-center justify-between px-4 py-3">
      <div className="flex items-center gap-3">
        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
          <Weight className="h-3.5 w-3.5 text-primary" />
        </div>
        <div>
          <div className="text-base font-bold text-gray-800">{record.weightKg.toFixed(1)} kg</div>
          {record.notes && <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{record.notes}</p>}
        </div>
      </div>
      <div className="flex items-center gap-1.5">
        <span className="text-xs text-gray-400">{formatDate(record.recordedAt)}</span>
        <button
          onClick={() => onEdit(record.id)}
          className="h-7 w-7 flex items-center justify-center rounded-lg text-gray-300 hover:text-primary hover:bg-primary/10 transition-colors"
          title="編集"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

function WeightEditRow({
  record,
  onSave,
  onCancel,
  isPending,
}: {
  record: WeightRecord;
  onSave: (data: { weightKg: number; notes: string }) => void;
  onCancel: () => void;
  isPending: boolean;
}) {
  const form = useForm({
    defaultValues: { weightKg: String(record.weightKg), notes: record.notes ?? "" },
  });

  return (
    <div className="px-4 py-3 bg-orange-50 border-l-2 border-primary space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-primary flex items-center gap-1">
          <Pencil className="h-3 w-3" />記録を編集
        </span>
        <button onClick={onCancel} className="text-gray-400 hover:text-gray-600">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label className="text-xs">体重 (kg)</Label>
          <Input type="number" step="0.1" className="h-9" {...form.register("weightKg")} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">備考</Label>
          <Input className="h-9" {...form.register("notes")} placeholder="特記事項" />
        </div>
      </div>
      <Button
        size="sm"
        className="w-full gap-1.5"
        onClick={form.handleSubmit((v) => onSave({ weightKg: Number(v.weightKg), notes: v.notes }))}
        disabled={isPending}
      >
        <Check className="h-3.5 w-3.5" />
        {isPending ? "保存中..." : "変更を保存"}
      </Button>
    </div>
  );
}

export default function WeightsNew() {
  const params = useParams();
  const residentId = parseInt(params.residentId || "0");
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState<number | null>(null);

  const { data: resident } = useGetResident(residentId, { query: { enabled: !!residentId } });
  const { data: allWeights = [], isLoading: isHistoryLoading } = useListWeights(
    { resident_id: residentId },
    { query: { enabled: !!residentId } }
  );

  const createMutation = useCreateWeight();
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: { weightKg: number; notes: string } }) => {
      const res = await fetch(`/api/weights/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ weightKg: data.weightKg, notes: data.notes }),
      });
      if (!res.ok) throw new Error("Failed to update");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "更新しました" });
      setEditingId(null);
      queryClient.invalidateQueries({ queryKey: getListWeightsQueryKey({ resident_id: residentId }) });
    },
    onError: () => toast({ title: "エラーが発生しました", variant: "destructive" }),
  });

  const form = useForm({ defaultValues: { weightKg: "", notes: "" } });

  const hasThisMonthRecord = allWeights.some((w: any) => isThisMonth(w.recordedAt));

  const onSubmit = (values: any) => {
    createMutation.mutate(
      {
        data: {
          residentId,
          recordedAt: new Date().toISOString(),
          weightKg: Number(values.weightKg),
          notes: values.notes,
        },
      },
      {
        onSuccess: () => {
          toast({ title: "保存しました" });
          form.reset();
          queryClient.invalidateQueries({ queryKey: getListWeightsQueryKey({ resident_id: residentId }) });
        },
        onError: () => toast({ title: "エラーが発生しました", variant: "destructive" }),
      }
    );
  };

  const grouped = groupByMonth(allWeights as WeightRecord[]);
  const monthKeys = Array.from(grouped.keys());

  return (
    <Layout>
      <div className="space-y-5 max-w-2xl mx-auto">
        <div className="flex items-center gap-3">
          <Link href="/weights">
            <Button variant="ghost" size="icon">
              <ChevronLeft className="h-6 w-6" />
            </Button>
          </Link>
          <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
            <Weight className="h-5 w-5 text-primary" />
            体重記録
          </h1>
        </div>

        {resident && (
          <div className="bg-primary/5 p-4 rounded-xl border border-primary/20 flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold text-lg">
              {resident.lastName.charAt(0)}
            </div>
            <div>
              <div className="text-xs text-muted-foreground">{resident.roomNumber}</div>
              <div className="font-bold text-lg">{resident.lastName} {resident.firstName}様</div>
            </div>
          </div>
        )}

        {/* New entry form — hidden if already recorded this month */}
        {!hasThisMonthRecord ? (
          <Card>
            <CardContent className="p-5">
              <h2 className="font-bold text-gray-700 mb-4 text-sm">今月の体重を記録</h2>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <div className="space-y-2">
                  <Label>体重 (kg)</Label>
                  <Input
                    type="number"
                    step="0.1"
                    {...form.register("weightKg")}
                    placeholder="60.5"
                    required
                    className="text-lg"
                  />
                </div>
                <div className="space-y-2">
                  <Label>備考</Label>
                  <Textarea {...form.register("notes")} placeholder="特記事項" className="h-24 resize-none" />
                </div>
                <Button type="submit" className="w-full" disabled={createMutation.isPending}>
                  {createMutation.isPending ? "保存中..." : "体重を記録する"}
                </Button>
              </form>
            </CardContent>
          </Card>
        ) : (
          <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 flex items-center gap-2.5 text-green-700 text-sm font-medium">
            <Check className="h-4 w-4 shrink-0" />
            今月の体重は記録済みです。過去の記録から編集できます。
          </div>
        )}

        {/* History grouped by month */}
        <Card>
          <CardContent className="p-5 space-y-4">
            <h2 className="text-sm font-bold text-gray-700 flex items-center gap-2">
              <History className="h-4 w-4 text-gray-400" />
              体重記録履歴
              {allWeights.length > 0 && (
                <span className="text-xs font-normal text-gray-400">（{allWeights.length}件）</span>
              )}
            </h2>

            {isHistoryLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="h-12 bg-gray-50 rounded-xl animate-pulse" />
                ))}
              </div>
            ) : allWeights.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">記録がありません</p>
            ) : (
              <div className="space-y-4">
                {monthKeys.map((monthKey) => {
                  const records = grouped.get(monthKey)!;
                  const isCurrentMonth = monthKey === format(new Date(), "yyyy年M月", { locale: ja });
                  return (
                    <div key={monthKey}>
                      <div className="flex items-center gap-2 mb-2">
                        <CalendarDays className="h-3.5 w-3.5 text-gray-400" />
                        <span className={`text-xs font-bold ${isCurrentMonth ? "text-primary" : "text-gray-500"}`}>
                          {monthKey}
                          {isCurrentMonth && <span className="ml-1.5 text-xs bg-primary text-white px-1.5 py-0.5 rounded">今月</span>}
                        </span>
                      </div>
                      <div className="rounded-xl border border-gray-100 overflow-hidden divide-y divide-gray-50">
                        {records.map((r: WeightRecord) => (
                          <div key={r.id}>
                            {editingId === r.id ? (
                              <WeightEditRow
                                record={r}
                                isPending={updateMutation.isPending}
                                onCancel={() => setEditingId(null)}
                                onSave={(data) => updateMutation.mutate({ id: r.id, data })}
                              />
                            ) : (
                              <WeightHistoryRow record={r} onEdit={setEditingId} />
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
