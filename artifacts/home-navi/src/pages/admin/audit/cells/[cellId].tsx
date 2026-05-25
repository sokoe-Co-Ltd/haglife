import { useParams, useLocation } from "wouter";
import { format } from "date-fns";
import { Layout } from "@/components/layout";
import { Skeleton } from "@/components/ui/skeleton";
import { useGetAuditCell, getGetAuditCellQueryKey } from "@workspace/api-client-react";
import { AuditCellDetailBody } from "../components/AuditCellDetailBody";

export default function AuditCellDetailPage() {
  const params = useParams<{ cellId: string }>();
  const cellId = parseInt(params.cellId ?? "", 10);
  const [, navigate] = useLocation();
  const { data: cell, isLoading } = useGetAuditCell(cellId, {
    query: {
      enabled: Number.isFinite(cellId),
      queryKey: getGetAuditCellQueryKey(cellId),
    },
  });

  return (
    <Layout>
      <div className="p-4 md:p-6 max-w-2xl mx-auto">
        <button
          onClick={() => {
            if (window.history.length > 1) window.history.back();
            else navigate("/admin/audit");
          }}
          className="text-sm text-muted-foreground mb-4 hover:text-foreground"
        >
          ← 戻る
        </button>

        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-6 w-1/2" />
            <Skeleton className="h-32 w-full" />
          </div>
        ) : !cell ? (
          <p className="text-sm text-muted-foreground">セルが見つかりません</p>
        ) : (
          <>
            <h1 className="text-lg font-medium mb-1">
              {cell.residentName ?? "—"} ・{" "}
              {cell.plannedServiceLabel ?? cell.serviceLabel ?? "追加サービス"}
            </h1>
            {cell.modifiedAt && (
              <p className="text-xs text-muted-foreground mb-4">
                最終更新: {format(new Date(cell.modifiedAt), "yyyy/M/d HH:mm")}
              </p>
            )}
            <AuditCellDetailBody cell={cell} date={inferDate(cell.modifiedAt)} />
          </>
        )}
      </div>
    </Layout>
  );
}

function inferDate(modifiedAt: string | null | undefined): string {
  const d = modifiedAt ? new Date(modifiedAt) : new Date();
  return format(d, "yyyy-MM-dd");
}
