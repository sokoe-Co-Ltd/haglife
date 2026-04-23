import { Layout } from "@/components/layout";
import { useGetEliminationRoundStatus, useCheckEliminationRound, useResetEliminationRound } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Baby, AlertCircle, RefreshCw, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { getGetEliminationRoundStatusQueryKey } from "@workspace/api-client-react";

export default function EliminationsList() {
  const queryClient = useQueryClient();
  const { data: statuses, isLoading } = useGetEliminationRoundStatus();
  const checkMutation = useCheckEliminationRound();
  const resetMutation = useResetEliminationRound();

  const handleCheck = (residentId: number, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    checkMutation.mutate({ data: { residentId } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetEliminationRoundStatusQueryKey() });
      }
    });
  };

  const handleReset = () => {
    if (confirm("ラウンド状態をリセットしますか？")) {
      resetMutation.mutate(undefined, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetEliminationRoundStatusQueryKey() });
        }
      });
    }
  };

  const needsAttention = statuses?.filter((s) => s.daysSinceLastBm >= 2) || [];
  const ok = statuses?.filter((s) => s.daysSinceLastBm < 2) || [];

  return (
    <Layout>
      <div className="space-y-6 max-w-3xl mx-auto">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold tracking-tight">排泄</h1>
          <Button variant="outline" onClick={handleReset} disabled={resetMutation.isPending}>
            <RefreshCw className="h-4 w-4 mr-2" />
            ラウンドリセット
          </Button>
        </div>

        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        ) : (
          <div className="space-y-8">
            {needsAttention.length > 0 && (
              <section>
                <h2 className="text-lg font-semibold text-orange-500 flex items-center gap-2 mb-3">
                  <AlertCircle className="h-5 w-5" />
                  排便確認 ({needsAttention.length})
                </h2>
                <div className="space-y-2">
                  {needsAttention.map((status) => (
                    <ResidentEliminationCard key={status.residentId} status={status} onCheck={handleCheck} />
                  ))}
                </div>
              </section>
            )}

            <section>
              <h2 className="text-lg font-semibold flex items-center gap-2 mb-3">
                通常 ({ok.length})
              </h2>
              <div className="space-y-2">
                {ok.map((status) => (
                  <ResidentEliminationCard key={status.residentId} status={status} onCheck={handleCheck} />
                ))}
              </div>
            </section>
          </div>
        )}
      </div>
    </Layout>
  );
}

function ResidentEliminationCard({ status, onCheck }: { status: any, onCheck: (id: number, e: React.MouseEvent) => void }) {
  return (
    <Link href={`/eliminations/${status.residentId}`}>
      <Card className="cursor-pointer hover:bg-muted/50 transition-colors">
        <CardContent className="p-4 flex items-center justify-between">
          <div>
            <div className="font-medium text-lg flex items-center gap-2">
              {status.roomNumber && <span className="text-muted-foreground text-sm">{status.roomNumber}</span>}
              {status.residentName}
            </div>
            <div className="text-sm mt-1">
              最終排便から: <span className={status.daysSinceLastBm >= 2 ? "text-orange-500 font-bold" : ""}>{status.daysSinceLastBm}日</span>
            </div>
          </div>
          <Button
            variant={status.isCheckedInRound ? "secondary" : "outline"}
            size="icon"
            className={`rounded-full h-12 w-12 ${status.isCheckedInRound ? 'bg-primary text-primary-foreground' : ''}`}
            onClick={(e) => onCheck(status.residentId, e)}
          >
            {status.isCheckedInRound ? <Check className="h-6 w-6" /> : <Baby className="h-6 w-6" />}
          </Button>
        </CardContent>
      </Card>
    </Link>
  );
}
