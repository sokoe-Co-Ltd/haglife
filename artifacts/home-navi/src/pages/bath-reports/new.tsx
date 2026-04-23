import { Layout } from "@/components/layout";
import { useCreateBathReport, useListResidents, useListStaff } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ChevronLeft } from "lucide-react";
import { Link, useLocation } from "wouter";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm, Controller } from "react-hook-form";
import { useToast } from "@/hooks/use-toast";

export default function BathReportsNew() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  const { data: residents } = useListResidents();
  const { data: staff } = useListStaff();
  const createMutation = useCreateBathReport();

  const form = useForm({
    defaultValues: {
      residentId: "",
      staffId: "",
      temperature: "",
      bpSystolic: "",
      bpDiastolic: "",
      pulse: "",
      spo2: "",
      bathMemo: "",
    }
  });

  const onSubmit = (values: any) => {
    createMutation.mutate({
      data: {
        residentId: Number(values.residentId),
        staffId: Number(values.staffId),
        recordedAt: new Date().toISOString(),
        temperature: values.temperature ? Number(values.temperature) : undefined,
        bpSystolic: values.bpSystolic ? Number(values.bpSystolic) : undefined,
        bpDiastolic: values.bpDiastolic ? Number(values.bpDiastolic) : undefined,
        pulse: values.pulse ? Number(values.pulse) : undefined,
        spo2: values.spo2 ? Number(values.spo2) : undefined,
        bathMemo: values.bathMemo,
      }
    }, {
      onSuccess: () => {
        toast({ title: "保存しました" });
        setLocation("/bath-reports");
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
          <Link href="/bath-reports">
            <Button variant="ghost" size="icon">
              <ChevronLeft className="h-6 w-6" />
            </Button>
          </Link>
          <h1 className="text-2xl font-bold tracking-tight">入浴報告入力</h1>
        </div>

        <Card>
          <CardContent className="p-6">
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>利用者</Label>
                  <Controller
                    name="residentId"
                    control={form.control}
                    render={({ field }) => (
                      <Select onValueChange={field.onChange} value={field.value}>
                        <SelectTrigger>
                          <SelectValue placeholder="選択" />
                        </SelectTrigger>
                        <SelectContent>
                          {residents?.map(r => (
                            <SelectItem key={r.id} value={r.id.toString()}>
                              {r.roomNumber} {r.lastName} {r.firstName}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>
                <div className="space-y-2">
                  <Label>担当スタッフ</Label>
                  <Controller
                    name="staffId"
                    control={form.control}
                    render={({ field }) => (
                      <Select onValueChange={field.onChange} value={field.value}>
                        <SelectTrigger>
                          <SelectValue placeholder="選択" />
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
              </div>

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

              <div className="space-y-2">
                <Label>入浴メモ</Label>
                <Textarea {...form.register("bathMemo")} placeholder="特記事項" className="h-32" />
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
