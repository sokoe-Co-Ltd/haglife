import { Layout } from "@/components/layout";
import { useCreateElimination, useGetResident, useListEliminations } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ChevronLeft, ShieldCheck, ShieldAlert, Toilet, Clock, History } from "lucide-react";
import { Link, useParams, useLocation } from "wouter";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm, Controller } from "react-hook-form";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { ja } from "date-fns/locale";

type BackCheck = {
  id: number;
  residentId: number;
  checkedAt: string;
  notes: string | null;
  createdAt: string;
};

function useBackChecks(residentId: number) {
  return useQuery<BackCheck[]>({
    queryKey: ["elimination-back-checks", residentId],
    queryFn: async () => {
      const res = await fetch(`/api/eliminations/back-checks?resident_id=${residentId}`);
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
    enabled: !!residentId,
  });
}

function useCreateBackCheck(residentId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { residentId: number; notes?: string }) => {
      const res = await fetch("/api/eliminations/back-checks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to save");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["elimination-back-checks", residentId] });
      queryClient.invalidateQueries({ queryKey: ["/api/eliminations/round-status"] });
    },
  });
}

function formatDateTime(iso: string) {
  return format(new Date(iso), "M/d（E）HH:mm", { locale: ja });
}

function BackCheckSection({ residentId }: { residentId: number }) {
  const { data: backChecks = [], isLoading } = useBackChecks(residentId);
  const createMutation = useCreateBackCheck(residentId);
  const { toast } = useToast();
  const form = useForm({ defaultValues: { notes: "" } });

  const lastCheck = backChecks[0];
  const daysSince = lastCheck
    ? Math.floor((Date.now() - new Date(lastCheck.checkedAt).getTime()) / (1000 * 60 * 60 * 24))
    : null;

  const onSubmit = (values: { notes: string }) => {
    createMutation.mutate(
      { residentId, notes: values.notes || undefined },
      {
        onSuccess: () => {
          toast({ title: "背面確認を記録しました" });
          form.reset();
        },
        onError: () => {
          toast({ title: "エラーが発生しました", variant: "destructive" });
        },
      }
    );
  };

  return (
    <div className="space-y-3">
      <div className={`flex items-center justify-between p-3 rounded-xl border ${daysSince === null || daysSince >= 3 ? "bg-red-50 border-red-200" : daysSince === 0 ? "bg-green-50 border-green-200" : "bg-amber-50 border-amber-200"}`}>
        <div className="flex items-center gap-2">
          {daysSince === null || daysSince >= 3 ? (
            <ShieldAlert className="h-5 w-5 text-red-500" />
          ) : (
            <ShieldCheck className="h-5 w-5 text-green-500" />
          )}
          <div>
            <p className={`text-sm font-bold ${daysSince === null || daysSince >= 3 ? "text-red-700" : daysSince === 0 ? "text-green-700" : "text-amber-700"}`}>
              {daysSince === null
                ? "背面確認：未実施"
                : daysSince === 0
                ? "背面確認：本日実施済"
                : `背面確認：${daysSince}日経過`}
            </p>
            {lastCheck && (
              <p className="text-xs text-gray-500">最終確認：{formatDateTime(lastCheck.checkedAt)}</p>
            )}
          </div>
        </div>
      </div>

      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
        <div className="space-y-2">
          <Label className="text-xs text-gray-500">背面確認メモ（任意）</Label>
          <Textarea
            {...form.register("notes")}
            placeholder="皮膚状態・褥瘡の有無など…"
            className="h-20 text-sm resize-none"
          />
        </div>
        <Button
          type="submit"
          size="sm"
          className="w-full gap-2"
          variant="outline"
          disabled={createMutation.isPending}
        >
          <ShieldCheck className="h-4 w-4" />
          {createMutation.isPending ? "記録中..." : "背面確認を記録する"}
        </Button>
      </form>

      {!isLoading && backChecks.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs text-gray-400 font-medium">背面確認履歴</p>
          <div className="divide-y divide-gray-50 rounded-xl border border-gray-100 overflow-hidden bg-white">
            {backChecks.slice(0, 5).map((b) => (
              <div key={b.id} className="px-3 py-2.5 flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <Clock className="h-3.5 w-3.5 text-gray-300 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-medium text-gray-700">{formatDateTime(b.checkedAt)}</p>
                    {b.notes && <p className="text-xs text-gray-500 mt-0.5">{b.notes}</p>}
                  </div>
                </div>
                <ShieldCheck className="h-3.5 w-3.5 text-green-400 shrink-0 mt-0.5" />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

const TYPE_LABELS: Record<string, string> = {
  尿: "🚿 尿",
  便: "💩 便",
  入浴時: "🛁 入浴時",
  その他: "その他",
};

const AMOUNT_COLORS: Record<string, string> = {
  多: "bg-blue-100 text-blue-700",
  中: "bg-green-100 text-green-700",
  少: "bg-yellow-100 text-yellow-700",
  無: "bg-gray-100 text-gray-500",
};

export default function EliminationsNew() {
  const params = useParams();
  const residentId = parseInt(params.residentId || "0");
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const { data: resident } = useGetResident(residentId, { query: { enabled: !!residentId } });
  const { data: history = [], isLoading: isHistoryLoading } = useListEliminations(
    { resident_id: residentId },
    { query: { enabled: !!residentId } }
  );
  const createMutation = useCreateElimination();

  const form = useForm({
    defaultValues: {
      type: "便",
      amount: "中",
      notes: "",
    }
  });

  const onSubmit = (values: any) => {
    createMutation.mutate({
      data: {
        residentId,
        recordedAt: new Date().toISOString(),
        type: values.type,
        amount: values.amount,
        notes: values.notes,
      }
    }, {
      onSuccess: () => {
        toast({ title: "保存しました" });
        setLocation("/eliminations");
      },
      onError: () => {
        toast({ title: "エラーが発生しました", variant: "destructive" });
      }
    });
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
            <div className="h-10 w-10 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold text-lg">
              {resident.lastName.charAt(0)}
            </div>
            <div>
              <div className="text-xs text-muted-foreground">{resident.roomNumber}</div>
              <div className="font-bold text-lg">{resident.lastName} {resident.firstName}</div>
            </div>
          </div>
        )}

        {/* New elimination entry */}
        <Card>
          <CardContent className="p-5">
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>種類</Label>
                  <Controller
                    name="type"
                    control={form.control}
                    render={({ field }) => (
                      <Select onValueChange={field.onChange} value={field.value}>
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
                      <Select onValueChange={field.onChange} value={field.value}>
                        <SelectTrigger>
                          <SelectValue placeholder="量を選択" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="多">多</SelectItem>
                          <SelectItem value="中">中</SelectItem>
                          <SelectItem value="少">少</SelectItem>
                          <SelectItem value="無">無</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>備考（聞き取り内容など）</Label>
                <Textarea {...form.register("notes")} placeholder="特記事項" className="h-28 resize-none" />
              </div>

              <Button type="submit" className="w-full" disabled={createMutation.isPending}>
                {createMutation.isPending ? "保存中..." : "排泄を記録する"}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Back skin check */}
        <Card>
          <CardContent className="p-5 space-y-3">
            <h2 className="text-sm font-bold text-gray-700 flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-green-500" />
              背面確認
            </h2>
            {residentId ? <BackCheckSection residentId={residentId} /> : null}
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
              <div className="divide-y divide-gray-50 rounded-xl border border-gray-100 overflow-hidden">
                {history.map((e: any) => (
                  <div key={e.id} className="px-3 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="text-lg">{e.type === "便" ? "💩" : e.type === "尿" ? "🚿" : e.type === "入浴時" ? "🛁" : "📝"}</div>
                      <div>
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
                    <span className="text-xs text-gray-400 shrink-0 ml-2">{formatDateTime(e.recordedAt)}</span>
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
