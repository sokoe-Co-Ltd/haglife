import React, { useState, useRef } from "react";
import { Layout } from "@/components/layout";
import { useCreateHandoverNote, useListResidents, useListStaff } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  ChevronLeft, Search, X, Camera,
  AlertCircle, Stethoscope, Check, ChevronDown,
} from "lucide-react";
import { Link, useLocation } from "wouter";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { useForm, Controller } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useToast } from "@/hooks/use-toast";

const formSchema = z.object({
  categoryId: z.string().min(1, "分類を選択してください"),
  residentId: z.string().optional(),
  content: z.string().min(1, "内容を入力してください"),
  authorId: z.string().min(1, "記入者を選択してください"),
  isImportant: z.boolean(),
  isDoctorReport: z.boolean(),
}).refine((data) => {
  if (data.categoryId === "resident" && !data.residentId) return false;
  return true;
}, {
  message: "利用者を選択してください",
  path: ["residentId"],
});

type FormValues = z.infer<typeof formSchema>;

function ResidentPickerDialog({
  residents,
  value,
  onChange,
}: {
  residents: any[];
  value: string;
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const selected = residents.find((r) => r.id.toString() === value);

  const filtered = residents.filter((r) => {
    if (r.movedOutAt) return false;
    const name = `${r.roomNumber} ${r.lastName} ${r.firstName}`;
    return name.includes(search);
  });

  function select(id: string) {
    onChange(id);
    setOpen(false);
    setSearch("");
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full flex items-center justify-between gap-2 h-12 px-3 rounded-lg border border-input bg-background hover:bg-gray-50 transition-colors"
      >
        {selected ? (
          <span className="text-base font-semibold text-gray-900">
            <span className="text-sm font-normal text-gray-400 mr-1.5">{selected.roomNumber}</span>
            {selected.lastName} {selected.firstName}
          </span>
        ) : (
          <span className="text-base text-muted-foreground">利用者を選択</span>
        )}
        <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md p-0">
          <DialogHeader className="px-4 pt-4 pb-2">
            <DialogTitle className="text-base">利用者を選択</DialogTitle>
          </DialogHeader>

          {/* Search */}
          <div className="px-4 pb-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="名前・部屋番号で検索"
                className="pl-9 h-10"
                autoFocus
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2"
                >
                  <X className="h-3.5 w-3.5 text-gray-400" />
                </button>
              )}
            </div>
          </div>

          {/* Scrollable list */}
          <div className="overflow-y-auto max-h-72 divide-y divide-gray-50 border-t border-gray-100">
            {filtered.length === 0 ? (
              <div className="py-8 text-center text-sm text-gray-400">
                該当する利用者が見つかりません
              </div>
            ) : (
              filtered.map((r) => {
                const isSelected = r.id.toString() === value;
                return (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => select(r.id.toString())}
                    className={`w-full flex items-center justify-between px-4 py-3.5 text-left hover:bg-gray-50 transition-colors ${isSelected ? "bg-primary/5" : ""}`}
                  >
                    <div>
                      <span className="text-xs text-gray-400 mr-2">{r.roomNumber}</span>
                      <span className={`text-base font-semibold ${isSelected ? "text-primary" : "text-gray-800"}`}>
                        {r.lastName} {r.firstName}
                      </span>
                    </div>
                    {isSelected && <Check className="h-4 w-4 text-primary shrink-0" />}
                  </button>
                );
              })
            )}
          </div>

          <div className="px-4 pb-4 pt-2 border-t border-gray-100">
            <Button
              type="button"
              variant="ghost"
              className="w-full text-sm text-gray-500"
              onClick={() => { onChange(""); setOpen(false); setSearch(""); }}
            >
              選択を解除
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function PhotoUploadSection({
  photos,
  onChange,
}: {
  photos: (File | null)[];
  onChange: (photos: (File | null)[]) => void;
}) {
  const inputRefs = [
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
  ];

  function handleFile(index: number, file: File | null) {
    const next = [...photos];
    next[index] = file;
    onChange(next);
  }

  function removePhoto(index: number) {
    handleFile(index, null);
    if (inputRefs[index].current) inputRefs[index].current!.value = "";
  }

  return (
    <div>
      <Label className="text-sm font-medium text-gray-700 mb-2 block">写真（最大5枚）</Label>
      <div className="flex flex-wrap gap-3">
        {photos.map((file, i) => {
          const url = file ? URL.createObjectURL(file) : null;
          return (
            <div key={i} className="relative">
              {url ? (
                <div className="relative h-20 w-20 rounded-xl overflow-hidden border border-gray-200">
                  <img src={url} alt={`photo ${i + 1}`} className="h-full w-full object-cover" />
                  <button
                    type="button"
                    onClick={() => removePhoto(i)}
                    className="absolute top-1 right-1 h-5 w-5 rounded-full bg-black/60 flex items-center justify-center"
                  >
                    <X className="h-3 w-3 text-white" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => inputRefs[i].current?.click()}
                  className="h-20 w-20 rounded-xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center gap-1 hover:border-primary/50 hover:bg-primary/5 transition-colors"
                >
                  <Camera className="h-5 w-5 text-gray-300" />
                  <span className="text-xs text-gray-300">追加</span>
                </button>
              )}
              <input
                ref={inputRefs[i]}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0] ?? null;
                  handleFile(i, f);
                }}
              />
            </div>
          );
        })}
        {photos.filter(Boolean).length === 0 && (
          <p className="text-xs text-gray-400 self-center">カメラアイコンをタップして写真を追加</p>
        )}
      </div>
    </div>
  );
}

function BigToggleButton({
  active,
  onToggle,
  icon: Icon,
  label,
  activeColor,
}: {
  active: boolean;
  onToggle: () => void;
  icon: React.ElementType;
  label: string;
  activeColor: string;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`flex items-center gap-2.5 px-5 h-14 rounded-xl border-2 font-bold text-base transition-all ${
        active
          ? `${activeColor} border-transparent text-white shadow-md`
          : "border-gray-200 text-gray-400 bg-gray-50 hover:border-gray-300"
      }`}
    >
      <Icon className="h-5 w-5 shrink-0" />
      {label}
    </button>
  );
}

function StaffPickerSection({
  staff,
  value,
  onChange,
  error,
}: {
  staff: any[];
  value: string;
  onChange: (v: string) => void;
  error?: string;
}) {
  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium text-gray-700">記入者</Label>
      <Select onValueChange={onChange} value={value}>
        <SelectTrigger className="h-12 text-base">
          <SelectValue placeholder="記入者を選択" />
        </SelectTrigger>
        <SelectContent>
          {staff.map((s) => (
            <SelectItem key={s.id} value={s.id.toString()} className="py-3 text-base">
              {s.lastName} {s.firstName}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}

export default function HandoverNew() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const createMutation = useCreateHandoverNote();
  const { data: residents = [] } = useListResidents();
  const { data: allStaff = [] } = useListStaff({ visible_only: true });
  const [photos, setPhotos] = useState<(File | null)[]>([null, null, null, null, null]);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      categoryId: "resident",
      residentId: "",
      content: "",
      authorId: "",
      isImportant: false,
      isDoctorReport: false,
    },
  });

  const category = form.watch("categoryId");
  const isImportant = form.watch("isImportant");
  const isDoctorReport = form.watch("isDoctorReport");

  async function fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  const onSubmit = async (values: FormValues) => {
    const photoFiles = photos.filter(Boolean) as File[];
    const photoUrls = await Promise.all(photoFiles.map(fileToBase64));

    createMutation.mutate({
      data: {
        category: values.categoryId === "resident" ? "利用者" : "その他",
        residentId: values.categoryId === "resident" && values.residentId
          ? parseInt(values.residentId)
          : undefined,
        content: values.content,
        authorId: parseInt(values.authorId),
        isImportant: values.isImportant,
        isDoctorReport: values.isDoctorReport,
        recordedAt: new Date().toISOString(),
        photo1Url: photoUrls[0] ?? undefined,
        photo2Url: photoUrls[1] ?? undefined,
        photo3Url: photoUrls[2] ?? undefined,
        photo4Url: photoUrls[3] ?? undefined,
        photo5Url: photoUrls[4] ?? undefined,
      },
    }, {
      onSuccess: () => {
        toast({ title: "保存しました" });
        setLocation("/handover");
      },
      onError: () => {
        toast({ title: "エラーが発生しました", variant: "destructive" });
      },
    });
  };

  return (
    <Layout>
      <div className="space-y-6 max-w-2xl mx-auto">
        <div className="flex items-center gap-4">
          <Link href="/handover">
            <Button variant="ghost" size="icon">
              <ChevronLeft className="h-6 w-6" />
            </Button>
          </Link>
          <h1 className="text-2xl font-bold tracking-tight">申し送り入力</h1>
        </div>

        <Card>
          <CardContent className="p-5 sm:p-6">
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">

              {/* 分類 */}
              <div className="space-y-2">
                <Label>分類</Label>
                <Controller
                  name="categoryId"
                  control={form.control}
                  render={({ field }) => (
                    <Select onValueChange={field.onChange} value={field.value}>
                      <SelectTrigger className="h-11">
                        <SelectValue placeholder="分類を選択" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="resident">利用者</SelectItem>
                        <SelectItem value="other">その他</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>

              {/* 利用者選択 */}
              {category === "resident" && (
                <div className="space-y-2">
                  <Label>利用者</Label>
                  <Controller
                    name="residentId"
                    control={form.control}
                    render={({ field }) => (
                      <ResidentPickerDialog
                        residents={residents}
                        value={field.value ?? ""}
                        onChange={field.onChange}
                      />
                    )}
                  />
                  {form.formState.errors.residentId && (
                    <p className="text-sm text-destructive">
                      {form.formState.errors.residentId.message}
                    </p>
                  )}
                </div>
              )}

              {/* 内容 */}
              <div className="space-y-2">
                <Label>内容</Label>
                <Textarea
                  {...form.register("content")}
                  placeholder="申し送り内容を入力"
                  className="h-36 resize-none"
                />
                {form.formState.errors.content && (
                  <p className="text-sm text-destructive">
                    {form.formState.errors.content.message}
                  </p>
                )}
              </div>

              {/* 写真 */}
              <PhotoUploadSection photos={photos} onChange={setPhotos} />

              {/* 重要 / ドクター報告 */}
              <div className="space-y-2">
                <Label>フラグ</Label>
                <div className="flex gap-3 flex-wrap">
                  <Controller
                    name="isImportant"
                    control={form.control}
                    render={({ field }) => (
                      <BigToggleButton
                        active={field.value}
                        onToggle={() => field.onChange(!field.value)}
                        icon={AlertCircle}
                        label="重要"
                        activeColor="bg-red-500"
                      />
                    )}
                  />
                  <Controller
                    name="isDoctorReport"
                    control={form.control}
                    render={({ field }) => (
                      <BigToggleButton
                        active={field.value}
                        onToggle={() => field.onChange(!field.value)}
                        icon={Stethoscope}
                        label="Dr.報告"
                        activeColor="bg-blue-500"
                      />
                    )}
                  />
                </div>
              </div>

              {/* 記入者 */}
              <Controller
                name="authorId"
                control={form.control}
                render={({ field }) => (
                  <StaffPickerSection
                    staff={allStaff}
                    value={field.value}
                    onChange={field.onChange}
                    error={form.formState.errors.authorId?.message}
                  />
                )}
              />

              <Button
                type="submit"
                className="w-full h-12 text-base font-bold"
                disabled={createMutation.isPending}
              >
                {createMutation.isPending ? "保存中..." : "保存する"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
