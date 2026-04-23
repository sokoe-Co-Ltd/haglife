import { Layout } from "@/components/layout";
import { useGetWeightsMonthlyStatus } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle, CheckCircle2, Weight } from "lucide-react";
import { Link } from "wouter";

export default function WeightsList() {
  const { data: statuses, isLoading } = useGetWeightsMonthlyStatus();

  const unrecorded = statuses?.filter((s) => !s.isRecordedThisMonth) || [];
  const recorded = statuses?.filter((s) => s.isRecordedThisMonth) || [];

  return (
    <Layout>
      <div className="space-y-6 max-w-3xl mx-auto">
        <h1 className="text-2xl font-bold tracking-tight">体重 (今月)</h1>

        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        ) : (
          <div className="space-y-8">
            <section>
              <h2 className="text-lg font-semibold text-destructive flex items-center gap-2 mb-3">
                <AlertCircle className="h-5 w-5" />
                今月未測定 ({unrecorded.length})
              </h2>
              <div className="space-y-2">
                {unrecorded.map((status) => (
                  <ResidentWeightCard key={status.residentId} status={status} />
                ))}
              </div>
            </section>

            {recorded.length > 0 && (
              <section>
                <h2 className="text-lg font-semibold text-green-600 flex items-center gap-2 mb-3">
                  <CheckCircle2 className="h-5 w-5" />
                  測定済み ({recorded.length})
                </h2>
                <div className="space-y-2">
                  {recorded.map((status) => (
                    <ResidentWeightCard key={status.residentId} status={status} />
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
}

function ResidentWeightCard({ status }: { status: any }) {
  return (
    <Link href={`/weights/${status.residentId}`}>
      <Card className={`cursor-pointer transition-colors ${!status.isRecordedThisMonth ? 'border-destructive/50 bg-destructive/5 hover:bg-destructive/10' : 'hover:bg-muted/50'}`}>
        <CardContent className="p-4 flex items-center justify-between">
          <div className="font-medium text-lg">
            {status.roomNumber && <span className="text-muted-foreground text-sm mr-2">{status.roomNumber}</span>}
            {status.residentName}
          </div>
          {status.isRecordedThisMonth ? (
            <div className="flex gap-4 text-sm font-bold">
              <span>{status.latestWeightKg} kg</span>
            </div>
          ) : (
            <div className="text-sm text-muted-foreground flex items-center gap-1">
              <Weight className="h-4 w-4" />
              未測定
            </div>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}
