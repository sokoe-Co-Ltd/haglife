import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  useListDayServices,
  useDeleteDayService,
  getListDayServicesQueryKey,
} from "@workspace/api-client-react";
import type { DayService } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { DayServiceFormModal, WEEKDAYS } from "@/components/DayServiceFormModal";
import { Briefcase, Plus, Pencil, Trash2, MapPin, Package, Clock } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export function ResidentDayServiceCard({
  residentId,
  residentName,
}: {
  residentId: number;
  residentName?: string;
}) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data: services = [] } = useListDayServices(
    { resident_id: residentId },
    {
      query: {
        queryKey: getListDayServicesQueryKey({ resident_id: residentId }),
        enabled: !!residentId,
      },
    },
  );
  const deleteMut = useDeleteDayService();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<DayService | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DayService | null>(null);
  const [photoView, setPhotoView] = useState<string | null>(null);

  const invalidate = () =>
    qc.invalidateQueries({ queryKey: getListDayServicesQueryKey() });

  const handleDelete = () => {
    if (!deleteTarget) return;
    deleteMut.mutate(
      { id: deleteTarget.id },
      {
        onSuccess: () => {
          toast({ title: "デイサービス情報を削除しました" });
          invalidate();
          setDeleteTarget(null);
        },
        onError: () => toast({ title: "削除に失敗しました", variant: "destructive" }),
      },
    );
  };

  const photosOf = (s: DayService): string[] =>
    s.itemPhotoUrls?.length ? s.itemPhotoUrls : s.itemPhotoUrl ? [s.itemPhotoUrl] : [];

  const sortedDays = (days: string[]) =>
    [...days].sort((a, b) => WEEKDAYS.indexOf(a) - WEEKDAYS.indexOf(b));

  return (
    <Card>
      <CardHeader className="py-3 px-4 border-b">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Briefcase className="h-4 w-4 text-primary" />デイサービス
          </CardTitle>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          >
            <Plus className="h-4 w-4 mr-1" />追加
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-4 space-y-3">
        {services.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-4">
            デイサービス情報は未登録です
          </p>
        ) : (
          services.map((svc) => (
            <div key={svc.id} className="border border-gray-100 rounded-xl p-3 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-gray-800">
                    {svc.facilityName || "施設名未登録"}
                  </p>
                  <div className="flex gap-1 mt-1.5 flex-wrap">
                    {sortedDays(svc.usageDays).map((d) => (
                      <span
                        key={d}
                        className="w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center"
                      >
                        {d}
                      </span>
                    ))}
                  </div>
                  {(svc.pickupTime || svc.returnTime) && (
                    <p className="text-xs font-bold text-gray-600 mt-1.5 flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5 text-primary" />
                      {svc.pickupTime ? `お迎え ${svc.pickupTime}` : ""}
                      {svc.pickupTime && svc.returnTime ? "　" : ""}
                      {svc.returnTime ? `お帰り ${svc.returnTime}` : ""}
                    </p>
                  )}
                </div>
                <div className="flex gap-1 shrink-0">
                  <button
                    onClick={() => {
                      setEditing(svc);
                      setFormOpen(true);
                    }}
                    className="p-2 rounded-full text-gray-400 hover:text-primary hover:bg-gray-50"
                    aria-label="編集"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setDeleteTarget(svc)}
                    className="p-2 rounded-full text-gray-400 hover:text-red-500 hover:bg-red-50"
                    aria-label="削除"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {svc.itemsToBring && (
                <div className="bg-gray-50 rounded-lg p-2.5">
                  <p className="text-xs font-bold text-gray-700 mb-0.5 flex items-center gap-1">
                    <Package className="h-3 w-3" />持参物
                  </p>
                  <p className="text-xs text-gray-600 whitespace-pre-wrap">{svc.itemsToBring}</p>
                </div>
              )}

              {svc.itemLocations && (
                <div className="bg-gray-50 rounded-lg p-2.5">
                  <p className="text-xs font-bold text-gray-700 mb-0.5 flex items-center gap-1">
                    <MapPin className="h-3 w-3" />置き場所
                  </p>
                  <p className="text-xs text-gray-600 whitespace-pre-wrap">{svc.itemLocations}</p>
                </div>
              )}

              {photosOf(svc).length > 0 && (
                <div className="flex gap-2 overflow-x-auto">
                  {photosOf(svc).map((url, i) => (
                    <button
                      key={i}
                      onClick={() => setPhotoView(url)}
                      className="shrink-0 w-16 h-16 rounded-lg overflow-hidden border border-gray-200"
                    >
                      <img src={url} alt={`配置写真${i + 1}`} className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))
        )}
      </CardContent>

      <DayServiceFormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        residentId={residentId}
        residentName={residentName}
        existing={editing}
        onSaved={invalidate}
      />

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>デイサービス情報を削除しますか？</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget?.facilityName || "施設名未登録"}のデイサービス情報を削除します。この操作は取り消せません。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-500 hover:bg-red-600">
              削除する
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {photoView && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setPhotoView(null)}
        >
          <img src={photoView} alt="配置写真" className="max-w-full max-h-full rounded-lg" />
        </div>
      )}
    </Card>
  );
}
