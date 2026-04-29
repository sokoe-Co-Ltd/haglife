import { useRef, useState, useEffect } from "react";
import { Layout } from "@/components/layout";
import { useCreateBathReport, useListResidents, useListStaff } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Bath, Camera, ChevronLeft, FileText, Image, X } from "lucide-react";
import { Link, useLocation } from "wouter";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm, Controller } from "react-hook-form";
import { useToast } from "@/hooks/use-toast";

function useIsTouchDevice() {
  const [isTouch, setIsTouch] = useState(false);
  useEffect(() => { setIsTouch(navigator.maxTouchPoints > 0); }, []);
  return isTouch;
}

export default function BathReportsNew() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [showPicker, setShowPicker] = useState(false);
  const isTouch = useIsTouchDevice();

  const { data: residents } = useListResidents();
  const { data: staff } = useListStaff({ visible_only: true });
  const createMutation = useCreateBathReport();

  const form = useForm({
    defaultValues: {
      residentId: "",
      staffId: "",
      handoverNotes: "",
    },
  });

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoPreview(URL.createObjectURL(file));
    setShowPicker(false);
  };

  const handleIconClick = () => {
    if (isTouch) {
      setShowPicker(true);
    } else {
      galleryRef.current?.click();
    }
  };

  const onSubmit = (values: any) => {
    if (!values.residentId || !values.staffId) {
      toast({ title: "利用者と担当スタッフを選択してください", variant: "destructive" });
      return;
    }
    createMutation.mutate(
      {
        data: {
          residentId: Number(values.residentId),
          staffId: Number(values.staffId),
          recordedAt: new Date().toISOString(),
          handoverNotes: values.handoverNotes || undefined,
        },
      },
      {
        onSuccess: () => {
          toast({ title: "保存しました" });
          setLocation("/bath-reports");
        },
        onError: () => {
          toast({ title: "エラーが発生しました", variant: "destructive" });
        },
      }
    );
  };

  const visibleResidents = residents?.filter((r) => r.isVisible !== false && !r.movedOutAt) ?? [];

  return (
    <Layout>
      <div className="space-y-5 max-w-2xl mx-auto">
        <div className="flex items-center gap-3">
          <Link href="/bath-reports">
            <Button variant="ghost" size="icon">
              <ChevronLeft className="h-6 w-6" />
            </Button>
          </Link>
          <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
            <Bath className="h-5 w-5 text-primary" />
            入浴報告入力
          </h1>
        </div>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          {/* Main fields: resident + staff */}
          <Card>
            <CardContent className="p-5 space-y-4">
              <div className="space-y-2">
                <Label className="text-sm font-bold">利用者</Label>
                <Controller
                  name="residentId"
                  control={form.control}
                  render={({ field }) => (
                    <Select onValueChange={field.onChange} value={field.value}>
                      <SelectTrigger className="h-11">
                        <SelectValue placeholder="利用者を選択" />
                      </SelectTrigger>
                      <SelectContent>
                        {visibleResidents.map((r) => (
                          <SelectItem key={r.id} value={r.id.toString()}>
                            {r.roomNumber}　{r.lastName} {r.firstName}様
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-bold">入浴介助者（担当スタッフ）</Label>
                <Controller
                  name="staffId"
                  control={form.control}
                  render={({ field }) => (
                    <Select onValueChange={field.onChange} value={field.value}>
                      <SelectTrigger className="h-11">
                        <SelectValue placeholder="担当スタッフを選択" />
                      </SelectTrigger>
                      <SelectContent>
                        {staff?.map((s) => (
                          <SelectItem key={s.id} value={s.id.toString()}>
                            {s.lastName} {s.firstName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
            </CardContent>
          </Card>

          {/* 報告事項 section */}
          <Card>
            <CardContent className="p-5 space-y-4">
              <h2 className="text-sm font-bold text-gray-700 flex items-center gap-2">
                <FileText className="h-4 w-4 text-gray-400" />
                報告事項
              </h2>

              <div className="space-y-2">
                <Label className="text-sm">申し送り内容</Label>
                <Textarea
                  {...form.register("handoverNotes")}
                  placeholder="入浴中の様子、特記事項、次の担当者への申し送りなど"
                  className="h-28 resize-none"
                />
              </div>

              {/* Photo section */}
              <div className="space-y-2">
                <Label className="text-sm">写真</Label>
                {/* Hidden inputs */}
                <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handlePhotoChange} />
                <input ref={galleryRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />

                {photoPreview ? (
                  <div className="relative">
                    <img
                      src={photoPreview}
                      alt="撮影した写真"
                      className="w-full max-h-56 object-cover rounded-xl border border-gray-100"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setPhotoPreview(null);
                        if (cameraRef.current) cameraRef.current.value = "";
                        if (galleryRef.current) galleryRef.current.value = "";
                      }}
                      className="absolute top-2 right-2 h-7 w-7 bg-white rounded-full shadow flex items-center justify-center text-gray-500 hover:text-red-500 transition-colors"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={handleIconClick}
                    className="w-full flex flex-col items-center justify-center gap-2 py-6 rounded-xl border-2 border-dashed border-gray-200 text-gray-400 hover:border-primary hover:text-primary transition-colors"
                  >
                    <div className="flex items-center gap-1.5">
                      <Camera className="h-5 w-5" />
                      <span className="text-gray-300 text-lg font-light">/</span>
                      <Image className="h-5 w-5" />
                    </div>
                    <span className="text-xs font-medium">写真を追加</span>
                  </button>
                )}
              </div>
            </CardContent>
          </Card>

          <Button type="submit" className="w-full h-12 text-base" disabled={createMutation.isPending}>
            {createMutation.isPending ? "保存中..." : "保存する"}
          </Button>
        </form>
      </div>

      {/* Action sheet for photo picker (touch devices only) */}
      {showPicker && (
        <div
          className="fixed inset-0 z-50 flex items-end"
          onClick={() => setShowPicker(false)}
        >
          <div className="absolute inset-0 bg-black/40" />
          <div
            className="relative w-full bg-white rounded-t-2xl pb-8 pt-2 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-1 bg-gray-300 rounded-full mx-auto mb-4" />
            <p className="text-center text-sm font-semibold text-gray-500 mb-3">写真を追加</p>
            <button
              type="button"
              className="w-full flex items-center gap-4 px-6 py-4 hover:bg-gray-50 active:bg-gray-100 transition-colors"
              onClick={() => {
                setShowPicker(false);
                setTimeout(() => cameraRef.current?.click(), 50);
              }}
            >
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Camera className="h-5 w-5 text-primary" />
              </div>
              <div className="text-left">
                <p className="text-sm font-semibold text-gray-800">カメラで撮影</p>
              </div>
            </button>
            <button
              type="button"
              className="w-full flex items-center gap-4 px-6 py-4 hover:bg-gray-50 active:bg-gray-100 transition-colors"
              onClick={() => {
                setShowPicker(false);
                setTimeout(() => galleryRef.current?.click(), 50);
              }}
            >
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Image className="h-5 w-5 text-primary" />
              </div>
              <div className="text-left">
                <p className="text-sm font-semibold text-gray-800">ライブラリから選択</p>
              </div>
            </button>
            <button
              type="button"
              className="w-full mt-2 mx-auto block text-center text-sm text-gray-400 py-3"
              onClick={() => setShowPicker(false)}
            >
              キャンセル
            </button>
          </div>
        </div>
      )}
    </Layout>
  );
}
