import { useState } from "react";
import { Layout } from "@/components/layout";
import { useCreateElimination, useGetResident, useListEliminations } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ChevronLeft, Toilet, History, Pencil, X, Check } from "lucide-react";
import { Link, useParams, useLocation } from "wouter";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm, Controller } from "react-hook-form";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { getListEliminationsQueryKey } from "@workspace/api-client-react";
import { format } from "date-fns";
import { ja } from "date-fns/locale";

function formatDateTime(iso: string) {
  return format(new Date(iso), "M/d（E）HH:mm", { locale: ja });
}

const AMOUNT_COLORS: Record<string, string> = {
  多量: "bg-blue-100 text-blue-700",
  大量: "bg-blue-200 text-blue-800",
  多: "bg-blue-100 text-blue-700",
  中量: "bg-green-100 text-green-700",
  中: "bg-green-100 text-green-700",
  少量: "bg-yellow-100 text-yellow-700",
  少: "bg-yellow-100 text-yellow-700",
  微量: "bg-orange-100 text-orange-700",
  失禁: "bg-red-100 text-red-700",
  なし: "bg-gray-100 text-gray-500",
  無: "bg-gray-100 text-gray-500",
};

const AMOUNT_OPTIONS: Record<string, { value: string; label: string }[]> = {
  便: [
    { value: "大量", label: "大量" },
    { value: "多量", label: "多量" },
    { value: "中量", label: "中量" },
    { value: "少量", label: "少量" },
    { value: "微量", label: "微量" },
    { value: "なし", label: "なし" },
  ],
  尿: [
    { value: "多量", label: "多量" },
    { value: "中量", label: "中量" },
    { value: "少量", label: "少量" },
    { value: "微量", label: "微量" },
    { value: "失禁", label: "失禁" },
    { value: "なし", label: "なし" },
  ],
  default: [
    { value: "多", label: "多" },
    { value: "中", label: "中" },
    { value: "少", label: "少" },
    { value: "なし", label: "なし" },
  ],
};

function getAmountOptions(type: string) {
  return AMOUNT_OPTIONS[type] ?? AMOUNT_OPTIONS.default;
}

function AmountSelect({
  value,
  onChange,
  type,
  triggerClass,
}: {
  value: string;
  onChange: (v: string) => void;
  type: string;
  triggerClass?: string;
}) {
  const options = getAmountOptions(type);
  const validValues = options.map((o) => o.value);
  const safeValue = validValues.includes(value) ? value : options[2]?.value ?? "";
  return (
    <Select
      onValueChange={onChange}
      value={safeValue}
    >
      <SelectTrigger className={triggerClass}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

type EditableElimination = {
  id: number;
  type: string;
  amount: string | null;
  notes: string | null;
  recordedAt: string;
};

function EliminationEditRow({
  elimination,
  onSave,
  onCancel,
  isPending,
}: {
  elimination: EditableElimination;
  onSave: (data: { type: string; amount: string; notes: string }) => void;
  onCancel: () => void;
  isPending: boolean;
}) {
  const form = useForm({
    defaultValues: {
      type: elimination.type,
      amount: elimination.amount ?? "中",
      notes: elimination.notes ?? "",
    },
  });

  return (
    <div className="px-3 py-3 bg-orange-50 border-l-2 border-primary space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-primary flex items-center gap-1">
          <Pencil className="h-3 w-3" />
          記録を編集
        </span>
        <button onClick={onCancel} className="text-gray-400 hover:text-gray-600">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label className="text-xs">種類</Label>
          <Controller
            name="type"
            control={form.control}
            render={({ field }) => (
              <Select onValueChange={(v) => { field.onChange(v); form.setValue("amount", getAmountOptions(v)[2]?.value ?? ""); }} value={field.value}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="尿">🚿 尿</SelectItem>
                  <SelectItem value="便">💩 便</SelectItem>
                  <SelectItem value="入浴時">🛁 入浴時</SelectItem>
                  <SelectItem value="その他">その他</SelectItem>
                </SelectContent>
              </Select>
            )}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">量</Label>
          <Controller
            name="amount"
            control={form.control}
            render={({ field }) => (
              <AmountSelect
                value={field.value}
                onChange={field.onChange}
                type={form.watch("type")}
                triggerClass="h-9"
              />
            )}
          />
        </div>
      </div>
      <div className="space-y-1">
        <Label className="text-xs">備考</Label>
        <Textarea {...form.register("notes")} placeholder="特記事項" className="h-16 resize-none" />
      </div>
      <Button
        size="sm"
        className="w-full gap-1.5"
        onClick={form.handleSubmit(onSave)}
        disabled={isPending}
      >
        <Check className="h-3.5 w-3.5" />
        {isPending ? "保存中..." : "変更を保存"}
      </Button>
    </div>
  );
}

export default function EliminationsNew() {
  const params = useParams();
  const residentId = parseInt(params.residentId || "0");
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [editingId, setEditingId] = useState<number | null>(null);

  const { data: resident } = useGetResident(residentId, { query: { enabled: !!residentId } });
  const { data: history = [], isLoading: isHistoryLoading } = useListEliminations(
    { resident_id: residentId },
    { query: { enabled: !!residentId } }
  );
  const createMutation = useCreateElimination();

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: { type: string; amount: string; notes: string } }) => {
      const res = await fetch(`/api/eliminations/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to update");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "更新しました" });
      setEditingId(null);
      queryClient.invalidateQueries({ queryKey: getListEliminationsQueryKey({ resident_id: residentId }) });
    },
    onError: () => toast({ title: "エラーが発生しました", variant: "destructive" }),
  });

  const [combinedMode, setCombinedMode] = useState(false);

  const form = useForm({
    defaultValues: { type: "便", amount: "中量", urineAmount: "中量", notes: "" }
  });

  const watchedType = form.watch("type");

  const onSubmit = async (values: any) => {
    const now = new Date().toISOString();

    if (combinedMode) {
      // Create two records: 便 + 尿
      try {
        await Promise.all([
          new Promise<void>((resolve, reject) =>
            createMutation.mutate(
              { data: { residentId, recordedAt: now, type: "便", amount: values.amount, notes: values.notes || null } },
              { onSuccess: () => resolve(), onError: reject }
            )
          ),
          new Promise<void>((resolve, reject) =>
            createMutation.mutate(
              { data: { residentId, recordedAt: now, type: "尿", amount: values.urineAmount, notes: null } },
              { onSuccess: () => resolve(), onError: reject }
            )
          ),
        ]);
        toast({ title: "便・尿の両方を記録しました" });
        setLocation("/eliminations");
      } catch {
        toast({ title: "エラーが発生しました", variant: "destructive" });
      }
    } else {
      createMutation.mutate(
        { data: { residentId, recordedAt: now, type: values.type, amount: values.amount, notes: values.notes || null } },
        {
          onSuccess: () => {
            toast({ title: "保存しました" });
            setLocation("/eliminations");
          },
          onError: () => toast({ title: "エラーが発生しました", variant: "destructive" }),
        }
      );
    }
  };

  return (
    <Layout>
      <div className="space-y-5 max-w-2xl mx-auto">
        <div className="flex items-center gap-3">
          <Link href="/eliminations">
            <Button variant="ghost" size="icon">
              <ChevronLeft className="h-6 w-6" />
            </Button>
          </Link>
          <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
            <Toilet className="h-5 w-5 text-primary" />
            排泄記録
          </h1>
        </div>

        {resident && (
          <div className="bg-primary/5 p-4 rounded-xl border border-primary/20 flex items-center gap-3">
            <div className={`h-10 w-10 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold text-lg ${resident.gender === "男性" ? "ring-2 ring-red-400" : ""}`}>
              {resident.lastName.charAt(0)}
            </div>
            <div>
              <div className="text-xs text-muted-foreground">{resident.roomNumber}</div>
              <div className="font-bold text-lg">{resident.lastName} {resident.firstName}様</div>
            </div>
          </div>
        )}

        {/* New elimination entry */}
        <Card>
          <CardContent className="p-5">
            {/* Mode toggle */}
            <div className="flex gap-2 mb-5">
              <button
                type="button"
                onClick={() => setCombinedMode(false)}
                className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all border ${
                  !combinedMode
                    ? "bg-primary text-white border-primary shadow-sm"
                    : "bg-white text-gray-500 border-gray-200 hover:border-gray-300"
                }`}
              >
                単独で記録
              </button>
              <button
                type="button"
                onClick={() => setCombinedMode(true)}
                className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all border ${
                  combinedMode
                    ? "bg-primary text-white border-primary shadow-sm"
                    : "bg-white text-gray-500 border-gray-200 hover:border-gray-300"
                }`}
              >
                💩🚿 便と尿（両方）
              </button>
            </div>

            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
              {combinedMode ? (
                /* Combined mode: 便 + 尿 simultaneously */
                <div className="space-y-4">
                  {/* 便 section */}
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">💩</span>
                      <span className="text-sm font-bold text-amber-800">便</span>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-amber-700">量</Label>
                      <Controller
                        name="amount"
                        control={form.control}
                        render={({ field }) => (
                          <AmountSelect
                            value={field.value}
                            onChange={field.onChange}
                            type="便"
                          />
                        )}
                      />
                    </div>
                  </div>

                  {/* 尿 section */}
                  <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">🚿</span>
                      <span className="text-sm font-bold text-blue-800">尿</span>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-blue-700">量</Label>
                      <Controller
                        name="urineAmount"
                        control={form.control}
                        render={({ field }) => (
                          <AmountSelect
                            value={field.value}
                            onChange={field.onChange}
                            type="尿"
                          />
                        )}
                      />
                    </div>
                  </div>
                </div>
              ) : (
                /* Single mode */
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>種類</Label>
                    <Controller
                      name="type"
                      control={form.control}
                      render={({ field }) => (
                        <Select
                          onValueChange={(v) => {
                            field.onChange(v);
                            form.setValue("amount", getAmountOptions(v)[2]?.value ?? "");
                          }}
                          value={field.value}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="種類を選択" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="尿">🚿 尿</SelectItem>
                            <SelectItem value="便">💩 便</SelectItem>
                            <SelectItem value="入浴時">🛁 入浴時</SelectItem>
                            <SelectItem value="その他">その他</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>量</Label>
                    <Controller
                      name="amount"
                      control={form.control}
                      render={({ field }) => (
                        <AmountSelect
                          value={field.value}
                          onChange={field.onChange}
                          type={watchedType}
                        />
                      )}
                    />
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label>備考（聞き取り内容など）</Label>
                <Textarea {...form.register("notes")} placeholder="特記事項" className="h-24 resize-none" />
              </div>

              <Button type="submit" className="w-full" disabled={createMutation.isPending}>
                {createMutation.isPending
                  ? "保存中..."
                  : combinedMode
                  ? "💩🚿 便と尿を記録する"
                  : "排泄を記録する"}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Accumulated history */}
        <Card>
          <CardContent className="p-5 space-y-3">
            <h2 className="text-sm font-bold text-gray-700 flex items-center gap-2">
              <History className="h-4 w-4 text-gray-400" />
              排泄記録履歴
              {history.length > 0 && <span className="text-xs font-normal text-gray-400">（{history.length}件）</span>}
            </h2>

            {isHistoryLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="h-12 bg-gray-50 rounded-xl animate-pulse" />
                ))}
              </div>
            ) : history.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">記録がありません</p>
            ) : (
              <div className="rounded-xl border border-gray-100 overflow-hidden">
                {history.map((e: any) => (
                  <div key={e.id} className="divide-y divide-gray-50">
                    {editingId === e.id ? (
                      <EliminationEditRow
                        elimination={e}
                        isPending={updateMutation.isPending}
                        onCancel={() => setEditingId(null)}
                        onSave={(data) => updateMutation.mutate({ id: e.id, data })}
                      />
                    ) : (
                      <div className="px-3 py-3 flex items-center justify-between">
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <div className="text-lg shrink-0">{e.type === "便" ? "💩" : e.type === "尿" ? "🚿" : e.type === "入浴時" ? "🛁" : "📝"}</div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-semibold text-gray-800">{e.type}</span>
                              {e.amount && (
                                <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${AMOUNT_COLORS[e.amount] ?? "bg-gray-100 text-gray-500"}`}>
                                  {e.amount}
                                </span>
                              )}
                            </div>
                            {e.notes && <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{e.notes}</p>}
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0 ml-2">
                          <span className="text-xs text-gray-400">{formatDateTime(e.recordedAt)}</span>
                          <button
                            onClick={() => setEditingId(e.id)}
                            className="h-7 w-7 flex items-center justify-center rounded-lg text-gray-300 hover:text-primary hover:bg-primary/10 transition-colors"
                            title="編集"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
