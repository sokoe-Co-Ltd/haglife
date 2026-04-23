import { Layout } from "@/components/layout";
import { useGetBathReport } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronLeft, Bath, Activity, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link, useParams } from "wouter";
import { format } from "date-fns";
import { ja } from "date-fns/locale";

// Note: we need to use useListBathReports and filter or ideally have a getBathReport API
// But the schema implies maybe no getBathReport? Wait, let's check API.
// Ah, the API list might not have a getBathReport. 
// I'll check if getBathReport is available. If not, we'll fetch list and filter.
// Looking at the hooks list in instructions:
// export const getListBathReportsQueryKey = (params?: ListBathReportsParams) => ...
// export function useListBathReports<...>
// export const useCreateBathReport = <...>
// export const useUpdateBathReport = <...>
// export const useDeleteBathReport = <...>
// So no useGetBathReport hook! We must fetch list and filter.
import { useListBathReports } from "@workspace/api-client-react";
import { useMemo } from "react";

export default function BathReportDetail() {
  const params = useParams();
  const id = parseInt(params.id || "0");
  
  const { data: reports, isLoading } = useListBathReports();
  
  const report = useMemo(() => reports?.find(r => r.id === id), [reports, id]);

  return (
    <Layout>
      <div className="space-y-6 max-w-2xl mx-auto">
        <div className="flex items-center gap-4">
          <Link href="/bath-reports">
            <Button variant="ghost" size="icon">
              <ChevronLeft className="h-6 w-6" />
            </Button>
          </Link>
          <h1 className="text-2xl font-bold tracking-tight">入浴報告詳細</h1>
        </div>

        {isLoading ? (
           <Card>
             <CardContent className="p-6 space-y-4">
                <Skeleton className="h-8 w-1/3" />
                <Skeleton className="h-32 w-full" />
             </CardContent>
           </Card>
        ) : !report ? (
           <div className="text-center py-12">見つかりませんでした</div>
        ) : (
          <div className="space-y-6">
            <Card>
              <CardHeader className="pb-3 border-b">
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-2">
                    <Bath className="h-5 w-5 text-primary" />
                    <CardTitle className="text-xl">
                      {report.residentName}
                    </CardTitle>
                  </div>
                  <div className="text-sm text-muted-foreground text-right">
                    <div>{format(new Date(report.recordedAt), "yyyy/MM/dd HH:mm", { locale: ja })}</div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-6 space-y-6">
                
                <div className="grid grid-cols-2 gap-4">
                   <div className="bg-secondary/30 p-4 rounded-lg">
                      <p className="text-xs font-bold text-muted-foreground mb-1">担当スタッフ</p>
                      <p className="font-medium">{report.staffName}</p>
                   </div>
                </div>

                <div>
                  <h3 className="text-sm font-bold text-primary mb-3 flex items-center gap-2">
                    <Activity className="h-4 w-4" />
                    入浴時バイタル
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-primary/5 p-4 rounded-lg border border-primary/10">
                     <div>
                        <p className="text-xs text-muted-foreground">体温 (KT)</p>
                        <p className="font-bold text-lg">{report.temperature || "-"}</p>
                     </div>
                     <div>
                        <p className="text-xs text-muted-foreground">脈拍 (P)</p>
                        <p className="font-bold text-lg">{report.pulse || "-"}</p>
                     </div>
                     <div>
                        <p className="text-xs text-muted-foreground">血圧 (BP)</p>
                        <p className="font-bold text-lg">{report.bpSystolic || "-"}/{report.bpDiastolic || "-"}</p>
                     </div>
                     <div>
                        <p className="text-xs text-muted-foreground">SpO2</p>
                        <p className="font-bold text-lg">{report.spo2 || "-"}</p>
                     </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-bold text-primary mb-3 flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    入浴メモ
                  </h3>
                  <div className="bg-card border p-4 rounded-lg">
                    <p className="text-sm whitespace-pre-wrap leading-relaxed">{report.bathMemo || "特記事項なし"}</p>
                  </div>
                </div>

              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </Layout>
  );
}
