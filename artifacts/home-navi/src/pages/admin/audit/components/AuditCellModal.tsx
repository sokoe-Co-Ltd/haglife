import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  useGetAuditCell,
  getGetAuditCellQueryKey,
  type AuditCellView,
} from "@workspace/api-client-react";
import { AuditCellDetailBody } from "./AuditCellDetailBody";

export function AuditCellModal({
  cell,
  date,
  open,
  onClose,
}: {
  cell: AuditCellView;
  date: string;
  open: boolean;
  onClose: () => void;
}) {
  // モーダル内で最新セルを再取得（mutation後の即時反映のため）。
  // 初期描画には一覧スナップショットを placeholderData として使う。
  const { data: latest } = useGetAuditCell(cell.id, {
    query: {
      enabled: open,
      queryKey: getGetAuditCellQueryKey(cell.id),
      placeholderData: cell,
    },
  });
  const current = latest ?? cell;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {current.residentName ?? "—"} ・{" "}
            {current.plannedServiceLabel ?? current.serviceLabel ?? "追加サービス"}
          </DialogTitle>
        </DialogHeader>
        <AuditCellDetailBody cell={current} date={date} />
      </DialogContent>
    </Dialog>
  );
}
