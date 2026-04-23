import { Layout } from "@/components/layout";
import { useGetVitalsTodayStatus } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Activity, AlertCircle, CheckCircle2 } from "lucide-react";
import { Link } from "wouter";

export default function VitalsList() {
  const { data: statuses, isLoading } = useGetVitalsTodayStatus();

  const recheckNeeded = statuses?.filter((s) => s.needsRecheck) || [];
  const ok = statuses?.filter((s) => !s.needsRecheck && s.isRecorded) || [];
  const unrecorded = statuses?.filter((s) => !s.isRecorded) || [];

  return (
    <Layout>
      <div className="space-y-6 max-w-3xl mx-auto">
        <h1 className="text-2xl font-bold tracking-tight">バイタル</h1>

        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        ) : (
          <div className="space-y-8">
            {recheckNeeded.length > 0 && (
              <section>
                <h2 className="text-lg font-semibold text-destructive flex items-center gap-2 mb-3">
                  <AlertCircle className="h-5 w-5" />
                  再測定必要 ({recheckNeeded.length})
                </h2>
                <div className="space-y-2">
                  {recheckNeeded.map((status) => (
                    <ResidentVitalCard key={status.residentId} status={status} />
                  ))}
                </div>
              </section>
            )}

            <section>
              <h2 className="text-lg font-semibold flex items-center gap-2 mb-3">
                未記録 ({unrecorded.length})
              </h2>
              <div className="space-y-2">
                {unrecorded.map((status) => (
                  <ResidentVitalCard key={status.residentId} status={status} />
                ))}
              </div>
            </section>

            {ok.length > 0 && (
              <section>
                <h2 className="text-lg font-semibold text-green-600 flex items-center gap-2 mb-3">
                  <CheckCircle2 className="h-5 w-5" />
                  記録済み・異常なし ({ok.length})
                </h2>
                <div className="space-y-2">
                  {ok.map((status) => (
                    <ResidentVitalCard key={status.residentId} status={status} />
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

function ResidentVitalCard({ status }: { status: any }) {
  return (
    <Link href={`/vitals/${status.residentId}`}>
      <Card className={`cursor-pointer transition-colors ${status.needsRecheck ? 'border-destructive bg-destructive/5 hover:bg-destructive/10' : 'hover:bg-muted/50'}`}>
        <CardContent className="p-4 flex items-center justify-between">
          <div className="font-medium text-lg">
            {status.roomNumber && <span className="text-muted-foreground text-sm mr-2">{status.roomNumber}</span>}
            {status.residentName}
          </div>
          {status.isRecorded ? (
            <div className="flex gap-4 text-sm">
              <span>KT: {status.temperature}</span>
              <span>BP: {status.bpSystolic}/{status.bpDiastolic}</span>
              <span>P: {status.pulse}</span>
              <span>S: {status.spo2}</span>
            </div>
          ) : (
            <div className="text-sm text-muted-foreground flex items-center gap-1">
              <Activity className="h-4 w-4" />
              未記録
            </div>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}
