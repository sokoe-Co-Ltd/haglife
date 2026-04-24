import { Layout } from "@/components/layout";
import { useGetEliminationRoundStatus, useCheckEliminationRound, useResetEliminationRound } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Toilet, AlertCircle, RefreshCw, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { getGetEliminationRoundStatusQueryKey } from "@workspace/api-client-react";
import { QuickActionsCard, StaffMemoCard, InfoCard } from "@/components/PageRightPanel";

function ResidentEliminationCard({ status, onCheck }: { status: any; onCheck: (id: number, e: React.MouseEvent) => void }) {
  const alert = status.daysSinceLastBm >= 2;
  const checked = status.checkedThisRound;
  return (
    <Link href={`/eliminations/${status.residentId}`} className="flex items-center justify-between px-4 py-3.5 hover:bg-gray-50 transition-colors">
      <div className="flex items-center gap-3 min-w-0">
        {alert ? (
          <span className="shrink-0 inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-primary/10 text-primary">排便確認</span>
        ) : (
          <span className="shrink-0 inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-green-100 text-green-600">通常</span>
        )}
        <div className="min-w-0">
          <span className="text-xs text-gray-400 mr-2">{status.roomNumber}</span>
          <span className="text-sm font-semibold text-gray-800">{status.residentName}</span>
        </div>
        <span className={`text-xs ${alert ? "text-primary font-bold" : "text-gray-500"}`}>
          {status.daysSinceLastBm}日経過
        </span>
      </div>
      <div className="flex items-center gap-2">
        <button
          className={`h-9 w-9 rounded-full flex items-center justify-center transition-all duration-200 ${
            checked
              ? "bg-primary text-white shadow-[0_0_10px_2px_rgba(249,115,22,0.5)]"
              : "border-2 border-gray-200 text-gray-400 hover:border-primary hover:text-primary"
          }`}
          onClick={(e) => onCheck(status.residentId, e)}
          title={checked ? "確認済み" : "確認する"}
        >
          <Toilet className="h-4 w-4" />
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

  const quickActions = [
    { label: "ラウンドリセット", icon: RefreshCw, onClick: handleReset },
  ];

  return (
    <Layout>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <Toilet className="h-5 w-5 text-primary" />
            排泄
            {statuses && <span className="ml-2 text-sm font-normal text-gray-500">（{statuses.length}名）</span>}
          </h1>
          <Button variant="outline" size="sm" onClick={handleReset} disabled={resetMutation.isPending} className="gap-1.5 lg:hidden">
            <RefreshCw className="h-4 w-4" />
            ラウンドリセット
          </Button>
        </div>

        {/* PC: two-column layout */}
        <div className="lg:grid lg:grid-cols-[1fr_260px] lg:gap-5 lg:items-start space-y-4 lg:space-y-0">
          {/* Main content */}
          <div className="space-y-4">
            {isLoading ? (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 divide-y divide-gray-50">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="px-4 py-4"><Skeleton className="h-4 w-2/3" /></div>
                ))}
              </div>
            ) : (
              <>
                {needsAttention.length > 0 && (
                  <div className="bg-white rounded-2xl shadow-sm border border-primary/10 overflow-hidden">
                    <div className="px-4 py-3 border-b border-primary/10 bg-primary/5">
                      <h2 className="text-sm font-bold text-primary flex items-center gap-2">
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
              </>
            )}
          </div>

          {/* Right panel (desktop only) */}
          <div className="hidden lg:flex flex-col gap-4">
            <QuickActionsCard actions={quickActions} />

            {needsAttention.length > 0 && (
              <InfoCard title="要確認の方" titleColor="text-primary" borderColor="border-primary/20">
                <div className="space-y-2">
                  {needsAttention.slice(0, 5).map((s: any) => (
                    <div key={s.residentId} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-primary shrink-0" />
                        <span className="text-xs text-gray-700">{s.residentName}</span>
                      </div>
                      <span className="text-xs text-primary font-bold">{s.daysSinceLastBm}日経過</span>
                    </div>
                  ))}
                  {needsAttention.length > 5 && (
                    <p className="text-xs text-primary">他 {needsAttention.length - 5}名</p>
                  )}
                </div>
              </InfoCard>
            )}

            <StaffMemoCard memo="声かけを意識して実施。体調の変化がないか注意深く観察をお願いします。" />
          </div>
        </div>
      </div>
    </Layout>
  );
}
