import { Layout } from "@/components/layout";
import { useGetDashboardToday, useGetDashboardAlerts } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity, AlertCircle, Utensils, Baby, FileText } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";

export default function Dashboard() {
  const { data: today, isLoading: isLoadingToday } = useGetDashboardToday();
  const { data: alerts, isLoading: isLoadingAlerts } = useGetDashboardAlerts();

  return (
    <Layout>
      <div className="space-y-6 max-w-5xl mx-auto">
        <h1 className="text-2xl font-bold tracking-tight">ホーム</h1>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">バイタル未記録</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {isLoadingToday ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <div className="text-2xl font-bold">{today?.vitalsMissingCount || 0}名</div>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">食事未記録 (昼)</CardTitle>
              <Utensils className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {isLoadingToday ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <div className="text-2xl font-bold">{today?.mealsMissingCount || 0}名</div>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">排泄確認待ち</CardTitle>
              <Baby className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {isLoadingToday ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <div className="text-2xl font-bold">{today?.eliminationAlertCount || 0}名</div>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">本日の申し送り</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {isLoadingToday ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <div className="text-2xl font-bold">{today?.handoverCount || 0}件</div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="border-destructive/20 bg-destructive/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-destructive">
                <AlertCircle className="h-5 w-5" />
                アラート (再測定・確認)
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoadingAlerts ? (
                <div className="space-y-2">
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                </div>
              ) : alerts?.vitalAlerts?.length === 0 && alerts?.eliminationAlerts?.length === 0 ? (
                <p className="text-muted-foreground">現在アラートはありません。</p>
              ) : (
                <div className="space-y-4">
                  {alerts?.vitalAlerts?.map((alert) => (
                    <Link key={alert.residentId} href={`/vitals/${alert.residentId}`}>
                      <div className="flex items-center justify-between p-3 bg-background rounded-lg border border-destructive/20 hover:bg-destructive/10 transition-colors cursor-pointer">
                        <div>
                          <p className="font-medium">{alert.residentName}</p>
                          <p className="text-sm text-muted-foreground">バイタル再測定が必要です</p>
                        </div>
                        <Activity className="h-5 w-5 text-destructive" />
                      </div>
                    </Link>
                  ))}
                  {alerts?.eliminationAlerts?.map((alert) => (
                    <Link key={alert.residentId} href={`/eliminations`}>
                      <div className="flex items-center justify-between p-3 bg-background rounded-lg border border-orange-500/20 hover:bg-orange-500/10 transition-colors cursor-pointer">
                        <div>
                          <p className="font-medium">{alert.residentName}</p>
                          <p className="text-sm text-muted-foreground">{alert.daysSince}日経過しています</p>
                        </div>
                        <Baby className="h-5 w-5 text-orange-500" />
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}
