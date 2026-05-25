import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import {
  useAcceptAuditNotification,
  getGetAuditNotificationsQueryKey,
  getGetAuditRouteSheetQueryKey,
  type AuditNotification,
} from "@workspace/api-client-react";

const DAY_NAMES = ["日", "月", "火", "水", "木", "金", "土"];

export function AcceptDialog({
  notification,
  date,
  onClose,
}: {
  notification: AuditNotification | null;
  date: string;
  onClose: () => void;
}) {
  const [scope, setScope] = useState<"day_only" | "add_to_template">("day_only");
  const qc = useQueryClient();
  const { toast } = useToast();
  const weekday = new Date(date + "T00:00:00").getDay();

  // 通知が変わるたびに day_only にリセット（前回選択の残留で誤操作するのを防ぐ）
  useEffect(() => {
    if (notification) setScope("day_only");
  }, [notification?.cellId]);

  const accept = useAcceptAuditNotification({
    mutation: {
      onSuccess: (response) => {
        qc.invalidateQueries({ queryKey: getGetAuditNotificationsQueryKey(date) });
        qc.invalidateQueries({ queryKey: getGetAuditRouteSheetQueryKey(date) });
        if (response.alreadyExists) {
          toast({
            title: "テンプレに同じサービスが存在",
            description:
              response.message ?? "その日限りの実績として確定しました",
          });
        } else if (scope === "add_to_template") {
          toast({
            title: `${DAY_NAMES[weekday]}曜日のテンプレートに追加しました`,
          });
        } else {
          toast({ title: "その日限りの実績として確定しました" });
        }
        onClose();
      },
      onError: () => {
        toast({ title: "採用に失敗しました", variant: "destructive" });
      },
    },
  });

  if (!notification) return null;

  const handleSubmit = () => {
    accept.mutate({
      cellId: notification.cellId,
      data:
        scope === "add_to_template"
          ? { scope, weekday }
          : { scope },
    });
  };

  return (
    <Dialog open={!!notification} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>追加サービスの採用</DialogTitle>
          <DialogDescription>
            {notification.residentName ?? "—"} ・{" "}
            {notification.serviceLabel ?? "追加サービス"} を採用します。
          </DialogDescription>
        </DialogHeader>

        <RadioGroup value={scope} onValueChange={(v) => setScope(v as "day_only" | "add_to_template")}>
          <div className="flex items-start gap-2">
            <RadioGroupItem value="day_only" id="day_only" className="mt-1" />
            <label htmlFor="day_only" className="text-sm cursor-pointer">
              <strong>その日限り</strong>の実績として確定
              <p className="text-xs text-muted-foreground mt-0.5">
                通知から消えます。テンプレートには影響しません。
              </p>
            </label>
          </div>
          <div className="flex items-start gap-2">
            <RadioGroupItem value="add_to_template" id="template" className="mt-1" />
            <label htmlFor="template" className="text-sm cursor-pointer">
              <strong>{DAY_NAMES[weekday]}曜日テンプレートに追加</strong>
              <p className="text-xs text-muted-foreground mt-0.5">
                次回以降の{DAY_NAMES[weekday]}曜日にも反映されます。
                <br />
                ※既に同じサービスがテンプレに存在する場合は、自動的に「その日限り」になります。
              </p>
            </label>
          </div>
        </RadioGroup>

        <DialogFooter>
          <button onClick={onClose} className="text-sm px-3 py-1.5 border rounded">
            キャンセル
          </button>
          <button
            onClick={handleSubmit}
            disabled={accept.isPending}
            className="text-sm px-3 py-1.5 bg-foreground text-background rounded disabled:opacity-50"
          >
            {accept.isPending ? "処理中..." : "採用する"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
