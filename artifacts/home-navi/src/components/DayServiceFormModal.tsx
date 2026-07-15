import { useState, useRef, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  useCreateDayService,
  useUpdateDayService,
} from "@workspace/api-client-react";
import type { DayService } from "@workspace/api-client-react";
import { Camera, X, Loader2 } from "lucide-react";

export const WEEKDAYS = ["月", "火", "水", "木", "金", "土", "日"];

type Props = {
  open: boolean;
  onClose: () => void;
  residentId: number;
  residentName?: string;
  existing?: DayService | null;
  onSaved: () => void;
};

export function DayServiceFormModal({
  open,
  onClose,
  residentId,
  residentName,
  existing,
  onSaved,
}: Props) {
  const { toast } = useToast();
  const [facilityName, setFacilityName] = useState("");
  const [usageDays, setUsageDays] = useState<string[]>([]);
  const [pickupTime, setPickupTime] = useState("");
  const [returnTime, setReturnTime] = useState("");
  const [itemsToBring, setItemsToBring] = useState("");
  const [itemLocations, setItemLocations] = useState("");
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setFacilityName(existing?.facilityName ?? "");
      setUsageDays(existing?.usageDays ?? []);
      setPickupTime(existing?.pickupTime ?? "");
      setReturnTime(existing?.returnTime ?? "");
      setItemsToBring(existing?.itemsToBring ?? "");
      setItemLocations(existing?.itemLocations ?? "");
      setPhotoUrls(
        existing?.itemPhotoUrls?.length
          ? existing.itemPhotoUrls
          : existing?.itemPhotoUrl
            ? [existing.itemPhotoUrl]
            : [],
      );
    }
  }, [open, existing]);

  const createMut = useCreateDayService();
  const updateMut = useUpdateDayService();
  const saving = createMut.isPending || updateMut.isPending;

  const toggleDay = (d: string) => {
    setUsageDays((prev) =>
      prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d],
    );
  };

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const formData = new FormData();
        formData.append("photo", file);
        const res = await fetch("/api/day-services/upload-photo", {
          method: "POST",
          body: formData,
        });
        if (!res.ok) throw new Error("Upload failed");
        const json = await res.json();
        setPhotoUrls((prev) => [...prev, json.photoUrl]);
      }
    } catch {
      toast({ title: "写真のアップロードに失敗しました", variant: "destructive" });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const handleSave = () => {
    if (usageDays.length === 0) {
      toast({ title: "利用曜日を1つ以上選択してください", variant: "destructive" });
      return;
    }
    const body = {
      facilityName: facilityName || null,
      usageDays,
      pickupTime: pickupTime || null,
      returnTime: returnTime || null,
      itemsToBring: itemsToBring || null,
      itemLocations: itemLocations || null,
      itemPhotoUrls: photoUrls,
    };
    const opts = {
      onSuccess: () => {
        toast({ title: existing ? "デイサービス情報を更新しました" : "デイサービス情報を登録しました" });
        onSaved();
        onClose();
      },
      onError: () => {
        toast({ title: "保存に失敗しました", variant: "destructive" });
      },
    };
    if (existing) {
      updateMut.mutate({ id: existing.id, data: body }, opts);
    } else {
      createMut.mutate({ data: { residentId, ...body } }, opts);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {existing ? "デイサービス情報の編集" : "デイサービス情報の登録"}
            {residentName && (
              <span className="block text-sm font-normal text-gray-500 mt-1">
                {residentName}様
              </span>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>施設名</Label>
            <Input
              value={facilityName}
              onChange={(e) => setFacilityName(e.target.value)}
              placeholder="例：デイサービス○○"
            />
          </div>

          <div className="space-y-1.5">
            <Label>利用曜日 <span className="text-red-500">*</span></Label>
            <div className="flex gap-1.5 flex-wrap">
              {WEEKDAYS.map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => toggleDay(d)}
                  className={`w-10 h-10 rounded-full text-sm font-bold transition-colors ${
                    usageDays.includes(d)
                      ? "bg-primary text-white"
                      : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>お迎え時間</Label>
              <Input
                type="time"
                value={pickupTime}
                onChange={(e) => setPickupTime(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>お帰り時間</Label>
              <Input
                type="time"
                value={returnTime}
                onChange={(e) => setReturnTime(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>持参物</Label>
            <Textarea
              value={itemsToBring}
              onChange={(e) => setItemsToBring(e.target.value)}
              placeholder="例：着替え一式、タオル2枚、おむつ、連絡帳"
              rows={3}
            />
          </div>

          <div className="space-y-1.5">
            <Label>置き場所メモ</Label>
            <Textarea
              value={itemLocations}
              onChange={(e) => setItemLocations(e.target.value)}
              placeholder="例：着替えはクローゼット右側の棚、連絡帳はベッドサイドの引き出し"
              rows={3}
            />
          </div>

          <div className="space-y-1.5">
            <Label>荷物の配置写真</Label>
            {photoUrls.length > 0 && (
              <div className="grid grid-cols-3 gap-2 mb-2">
                {photoUrls.map((url, i) => (
                  <div key={i} className="relative aspect-square rounded-lg overflow-hidden border border-gray-200">
                    <img src={url} alt={`配置写真${i + 1}`} className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => setPhotoUrls((prev) => prev.filter((_, j) => j !== i))}
                      className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-1"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => handleFiles(e.target.files)}
            />
            <Button
              type="button"
              variant="outline"
              className="w-full"
              disabled={uploading}
              onClick={() => fileRef.current?.click()}
            >
              {uploading
                ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />アップロード中...</>
                : <><Camera className="h-4 w-4 mr-2" />写真を追加</>}
            </Button>
          </div>
        </div>

        <div className="flex gap-2 pt-2">
          <Button variant="outline" className="flex-1" onClick={onClose} disabled={saving}>
            キャンセル
          </Button>
          <Button className="flex-1" onClick={handleSave} disabled={saving || uploading}>
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
            {existing ? "更新する" : "登録する"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
