import { Layout } from "@/components/layout";
import { useListBathReports } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Bath, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { format } from "date-fns";
import { ja } from "date-fns/locale";

export default function BathReportsList() {
  const { data: reports, isLoading } = useListBathReports();

  return (
    <Layout>
      <div className="space-y-6 max-w-3xl mx-auto">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Bath className="h-6 w-6" />
            入浴報告
          </h1>
          <Link href="/bath-reports/new">
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              新規作成
            </Button>
          </Link>
        </div>

        <div className="space-y-3">
          {isLoading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <Card key={i}>
                <CardContent className="p-4">
                  <Skeleton className="h-6 w-1/3 mb-2" />
                  <Skeleton className="h-4 w-1/2" />
                </CardContent>
              </Card>
            ))
          ) : reports?.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground bg-card rounded-lg border">
              入浴報告はまだありません
            </div>
          ) : (
            reports?.map((report) => (
              <Link key={report.id} href={`/bath-reports/${report.id}`}>
                <Card className="cursor-pointer hover:bg-muted/50 transition-colors">
                  <CardContent className="p-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="font-bold text-lg mb-1">{report.residentName}</div>
                        <div className="text-sm text-muted-foreground">
                          担当: {report.staffName}
                        </div>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {format(new Date(report.recordedAt), "MM/dd HH:mm", { locale: ja })}
                      </div>
                    </div>
                    {report.bathMemo && (
                      <p className="text-sm mt-3 line-clamp-2">{report.bathMemo}</p>
                    )}
                  </CardContent>
                </Card>
              </Link>
            ))
          )}
        </div>
      </div>
    </Layout>
  );
}
