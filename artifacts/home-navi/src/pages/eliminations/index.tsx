import { Layout } from "@/components/layout";
import { useGetEliminationRoundStatus, useCheckEliminationRound, useResetEliminationRound } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Baby, AlertCircle, RefreshCw, Check, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { getGetEliminationRoundStatusQueryKey } from "@workspace/api-client-react";

function ResidentEliminationCard({ status, onCheck }: { status: any; onCheck: (id: number, e: React.MouseEvent) => void }) {
  const alert = status.daysSinceLastBm >= 2;
  return (
    <Link href={`/eliminations/${status.residentId}`} className="flex items-center justify-between px-4 py-3.5 hover:bg-gray-50 transition-colors">
      <div className="flex items-center gap-3 min-w-0">
        {alert ? (
          <span className="shrink-0 inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-orange-100 text-orange-600">排便確認</span>
        ) : (
          <span className="shrink-0 inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-green-100 text-green-600">通常</span>
        )}
        <div className="min-w-0">
          <span className="text-xs text-gray-400 mr-2">{status.roomNumber}</span>
          <span className="text-sm font-semibold text-gray-800">{status.residentName}</span>
        </div>
        <span className={`text-xs ${alert ? "text-orange-500 font-bold" : "text-gray-500"}`}>
          {status.daysSinceLastBm}日経過
        </span>
      </div>
      <div className="flex items-center gap-2">
        <button
          className={`h-9 w-9 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${
            status.isCheckedInRound
              ? "bg-orange-500 text-white"
              : "border-2 border-gray-200 text-gray-400 hover:border-orange-400 hover:text-orange-500"
          }`}
          onClick={(e) => onCheck(status.residentId, e)}
        >
          {status.isCheckedInRound ? <Check className="h-4 w-4" /> : <Baby className="h-4 w-4" />}
        </button>
        <ChevronRight className="h-4 w-4 text-gray-300" />
      </div>
    </Link>
  );
}

export default function EliminationsList() {
  const queryClient = useQueryClient();
  const { data: statuses, isLoading } = useGetEliminationRoundStatus();
  const checkMutation = useCheckEliminationRound();
  const resetMutation = useResetEliminationRound();

  const handleCheck = (residentId: number, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    checkMutation.mutate({ data: { residentId } }, {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetEliminationRoundStatusQueryKey() }),
    });
  };

  const handleReset = () => {
    if (confirm("ラウンド状態をリセットしますか？")) {
      resetMutation.mutate(undefined, {
        onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetEliminationRoundStatusQueryKey() }),
      });
    }
  };

  const needsAttention = statuses?.filter((s) => s.daysSinceLastBm >= 2) || [];
  const ok = statuses?.filter((s) => s.daysSinceLastBm < 2) || [];

  return (
    <Layout>
      <div className="max-w-3xl mx-auto space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-800">排泄</h1>
          <Button variant="outline" size="sm" onClick={handleReset} disabled={resetMutation.isPending} className="gap-1.5">
            <RefreshCw className="h-4 w-4" />
            ラウンドリセット
          </Button>
        </div>

        {isLoading ? (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 divide-y divide-gray-50">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="px-4 py-4"><Skeleton className="h-4 w-2/3" /></div>
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            {needsAttention.length > 0 && (
              <div className="bg-white rounded-2xl shadow-sm border border-orange-100 overflow-hidden">
                <div className="px-4 py-3 border-b border-orange-100 bg-orange-50">
                  <h2 className="text-sm font-bold text-orange-600 flex items-center gap-2">
                    <AlertCircle className="h-4 w-4" />
                    排便確認が必要（{needsAttention.length}名）
                  </h2>
                </div>
                <div className="divide-y divide-gray-50">
                  {needsAttention.map((s) => <ResidentEliminationCard key={s.residentId} status={s} onCheck={handleCheck} />)}
                </div>
              </div>
            )}

            {ok.length > 0 && (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-100">
                  <h2 className="text-sm font-bold text-gray-700">通常（{ok.length}名）</h2>
                </div>
                <div className="divide-y divide-gray-50">
                  {ok.map((s) => <ResidentEliminationCard key={s.residentId} status={s} onCheck={handleCheck} />)}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
}
