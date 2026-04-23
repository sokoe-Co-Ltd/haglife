import { Layout } from "@/components/layout";
import { useCreateVital, useGetResident, useListStaff } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { ChevronLeft } from "lucide-react";
import { Link, useParams, useLocation } from "wouter";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm, Controller } from "react-hook-form";
import { useToast } from "@/hooks/use-toast";

export default function VitalsInput() {
  const params = useParams();
  const residentId = parseInt(params.residentId || "0");
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  const { data: resident } = useGetResident(residentId, { query: { enabled: !!residentId } });
  const { data: staff } = useListStaff();
  const createMutation = useCreateVital();

  const form = useForm({
    defaultValues: {
      temperature: "",
      bpSystolic: "",
      bpDiastolic: "",
      pulse: "",
      spo2: "",
      needsRecheck: false,
      isBath: false,
      bathType: "個浴",
      bathStaffId: "",
      bathMemo: "",
      notes: "",
    }
  });

  const isBath = form.watch("isBath");

  const onSubmit = (values: any) => {
    createMutation.mutate({
      data: {
        residentId,
        recordedAt: new Date().toISOString(),
        temperature: values.temperature ? Number(values.temperature) : undefined,
        bpSystolic: values.bpSystolic ? Number(values.bpSystolic) : undefined,
        bpDiastolic: values.bpDiastolic ? Number(values.bpDiastolic) : undefined,
        pulse: values.pulse ? Number(values.pulse) : undefined,
        spo2: values.spo2 ? Number(values.spo2) : undefined,
        needsRecheck: values.needsRecheck,
        isBath: values.isBath,
        bathType: values.isBath ? values.bathType : undefined,
        bathStaffId: values.isBath && values.bathStaffId ? Number(values.bathStaffId) : undefined,
        bathMemo: values.isBath ? values.bathMemo : undefined,
        notes: values.notes,
      }
    }, {
      onSuccess: () => {
        toast({ title: "保存しました" });
        setLocation("/vitals");
      },
      onError: () => {
        toast({ title: "エラーが発生しました", variant: "destructive" });
      }
    });
  };

  return (
    <Layout>
      <div className="space-y-6 max-w-2xl mx-auto">
        <div className="flex items-center gap-4">
          <Link href="/vitals">
            <Button variant="ghost" size="icon">
              <ChevronLeft className="h-6 w-6" />
            </Button>
          </Link>
          <h1 className="text-2xl font-bold tracking-tight">バイタル入力</h1>
        </div>

        {resident && (
          <div className="bg-primary/5 p-4 rounded-lg border border-primary/20 flex items-center gap-3">
             <div className="h-10 w-10 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold">
               {resident.lastName.charAt(0)}
             </div>
             <div>
               <div className="text-sm text-muted-foreground">{resident.roomNumber}</div>
               <div className="font-bold text-lg">{resident.lastName} {resident.firstName}</div>
             </div>
          </div>
        )}

        <Card>
          <CardContent className="p-6">
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>体温 (KT)</Label>
                  <Input type="number" step="0.1" {...form.register("temperature")} placeholder="36.5" />
                </div>
                <div className="space-y-2">
                  <Label>脈拍 (P)</Label>
                  <Input type="number" {...form.register("pulse")} placeholder="70" />
                </div>
                <div className="space-y-2">
                  <Label>血圧 上 (BP)</Label>
                  <Input type="number" {...form.register("bpSystolic")} placeholder="120" />
                </div>
                <div className="space-y-2">
                  <Label>血圧 下</Label>
                  <Input type="number" {...form.register("bpDiastolic")} placeholder="80" />
                </div>
                <div className="space-y-2">
                  <Label>SpO2</Label>
                  <Input type="number" {...form.register("spo2")} placeholder="98" />
                </div>
              </div>

              <div className="flex items-center space-x-2 bg-destructive/5 p-3 rounded-md border border-destructive/20">
                <Controller
                  name="needsRecheck"
                  control={form.control}
                  render={({ field }) => (
                    <Switch checked={field.value} onCheckedChange={field.onChange} id="needsRecheck" />
                  )}
                />
                <Label htmlFor="needsRecheck" className="text-destructive font-bold">再測定が必要</Label>
              </div>

              <div className="space-y-4 pt-4 border-t">
                <div className="flex items-center space-x-2">
                  <Controller
                    name="isBath"
                    control={form.control}
                    render={({ field }) => (
                      <Switch checked={field.value} onCheckedChange={field.onChange} id="isBath" />
                    )}
                  />
                  <Label htmlFor="isBath" className="font-bold text-base">入浴記録もつける</Label>
                </div>

                {isBath && (
                  <div className="space-y-4 pl-4 border-l-2 border-primary/20">
                    <div className="space-y-2">
                      <Label>入浴形式</Label>
                      <Controller
                        name="bathType"
                        control={form.control}
                        render={({ field }) => (
                          <Select onValueChange={field.onChange} value={field.value}>
                            <SelectTrigger>
                              <SelectValue placeholder="入浴形式" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="個浴">個浴</SelectItem>
                              <SelectItem value="小浴">小浴</SelectItem>
                              <SelectItem value="機械浴">機械浴</SelectItem>
                              <SelectItem value="その他">その他</SelectItem>
                            </SelectContent>
                          </Select>
                        )}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>介助者</Label>
                      <Controller
                        name="bathStaffId"
                        control={form.control}
                        render={({ field }) => (
                          <Select onValueChange={field.onChange} value={field.value}>
                            <SelectTrigger>
                              <SelectValue placeholder="介助者を選択" />
                            </SelectTrigger>
                            <SelectContent>
                              {staff?.map(s => (
                                <SelectItem key={s.id} value={s.id.toString()}>
                                  {s.lastName} {s.firstName}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>入浴メモ</Label>
                      <Textarea {...form.register("bathMemo")} placeholder="特記事項" />
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-2 pt-4 border-t">
                <Label>備考 (バイタル)</Label>
                <Textarea {...form.register("notes")} placeholder="バイタルに関する特記事項" />
              </div>

              <Button type="submit" className="w-full" disabled={createMutation.isPending}>
                {createMutation.isPending ? "保存中..." : "保存する"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
