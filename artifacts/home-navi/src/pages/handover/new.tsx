import { Layout } from "@/components/layout";
import { useCreateHandoverNote, useListResidents, useListStaff } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { ChevronLeft } from "lucide-react";
import { Link, useLocation } from "wouter";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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

export default function HandoverNew() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const createMutation = useCreateHandoverNote();
  const { data: residents } = useListResidents();
  const { data: staff } = useListStaff();

  const form = useForm<z.infer<typeof formSchema>>({
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

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    createMutation.mutate({
      data: {
        category: values.categoryId === "resident" ? "利用者" : "その他",
        residentId: values.categoryId === "resident" ? parseInt(values.residentId!) : undefined,
        content: values.content,
        authorId: parseInt(values.authorId),
        isImportant: values.isImportant,
        isDoctorReport: values.isDoctorReport,
      }
    }, {
      onSuccess: () => {
        toast({ title: "保存しました" });
        setLocation("/handover");
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
          <Link href="/handover">
            <Button variant="ghost" size="icon">
              <ChevronLeft className="h-6 w-6" />
            </Button>
          </Link>
          <h1 className="text-2xl font-bold tracking-tight">申し送り入力</h1>
        </div>

        <Card>
          <CardContent className="p-6">
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              
              <div className="space-y-3">
                <Label>分類</Label>
                <Controller
                  name="categoryId"
                  control={form.control}
                  render={({ field }) => (
                    <Select onValueChange={field.onChange} value={field.value}>
                      <SelectTrigger>
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

              {category === "resident" && (
                <div className="space-y-3">
                  <Label>利用者</Label>
                  <Controller
                    name="residentId"
                    control={form.control}
                    render={({ field }) => (
                      <Select onValueChange={field.onChange} value={field.value}>
                        <SelectTrigger>
                          <SelectValue placeholder="利用者を選択" />
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
                  {form.formState.errors.residentId && (
                    <p className="text-sm text-destructive">{form.formState.errors.residentId.message}</p>
                  )}
                </div>
              )}

              <div className="space-y-3">
                <Label>内容</Label>
                <Textarea 
                  {...form.register("content")} 
                  placeholder="申し送り内容を入力"
                  className="h-32"
                />
                {form.formState.errors.content && (
                  <p className="text-sm text-destructive">{form.formState.errors.content.message}</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center space-x-2">
                  <Controller
                    name="isImportant"
                    control={form.control}
                    render={({ field }) => (
                      <Switch checked={field.value} onCheckedChange={field.onChange} id="isImportant" />
                    )}
                  />
                  <Label htmlFor="isImportant">重要</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Controller
                    name="isDoctorReport"
                    control={form.control}
                    render={({ field }) => (
                      <Switch checked={field.value} onCheckedChange={field.onChange} id="isDoctorReport" />
                    )}
                  />
                  <Label htmlFor="isDoctorReport">Dr.報告</Label>
                </div>
              </div>

              <div className="space-y-3">
                <Label>記入者</Label>
                <Controller
                  name="authorId"
                  control={form.control}
                  render={({ field }) => (
                    <Select onValueChange={field.onChange} value={field.value}>
                      <SelectTrigger>
                        <SelectValue placeholder="記入者を選択" />
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
                {form.formState.errors.authorId && (
                  <p className="text-sm text-destructive">{form.formState.errors.authorId.message}</p>
                )}
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
