import { Layout } from "@/components/layout";
import { useCreateStaff } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ChevronLeft } from "lucide-react";
import { Link, useLocation } from "wouter";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm, Controller } from "react-hook-form";
import { useToast } from "@/hooks/use-toast";
import { Switch } from "@/components/ui/switch";

export default function StaffNew() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const createMutation = useCreateStaff();

  const form = useForm({
    defaultValues: {
      lastName: "",
      firstName: "",
      lastNameKana: "",
      firstNameKana: "",
      tel: "",
      role: "一般職員",
      isVisible: true,
    }
  });

  const onSubmit = (values: any) => {
    createMutation.mutate({
      data: values
    }, {
      onSuccess: () => {
        toast({ title: "保存しました" });
        setLocation("/staff");
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
          <Link href="/staff">
            <Button variant="ghost" size="icon">
              <ChevronLeft className="h-6 w-6" />
            </Button>
          </Link>
          <h1 className="text-2xl font-bold tracking-tight">職員登録</h1>
        </div>

        <Card>
          <CardContent className="p-6">
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>姓 (漢字)</Label>
                  <Input {...form.register("lastName")} required />
                </div>
                <div className="space-y-2">
                  <Label>名 (漢字)</Label>
                  <Input {...form.register("firstName")} required />
                </div>
                <div className="space-y-2">
                  <Label>姓 (ふりがな)</Label>
                  <Input {...form.register("lastNameKana")} />
                </div>
                <div className="space-y-2">
                  <Label>名 (ふりがな)</Label>
                  <Input {...form.register("firstNameKana")} />
                </div>
              </div>

              <div className="space-y-2">
                <Label>電話番号</Label>
                <Input type="tel" {...form.register("tel")} placeholder="090-1234-5678" />
              </div>

              <div className="space-y-2">
                <Label>権限</Label>
                <Controller
                  name="role"
                  control={form.control}
                  render={({ field }) => (
                    <Select onValueChange={field.onChange} value={field.value}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="一般職員">一般職員</SelectItem>
                        <SelectItem value="管理者">管理者</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>

              <div className="flex items-center space-x-2 pt-4">
                <Controller
                  name="isVisible"
                  control={form.control}
                  render={({ field }) => (
                    <Switch checked={field.value} onCheckedChange={field.onChange} id="isVisible" />
                  )}
                />
                <Label htmlFor="isVisible">一覧に表示する (アクティブ)</Label>
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
