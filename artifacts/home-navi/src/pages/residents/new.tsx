import { Layout } from "@/components/layout";
import { useCreateResident } from "@workspace/api-client-react";
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
import { Switch } from "@/components/ui/switch";

export default function ResidentsNew() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const createMutation = useCreateResident();

  const form = useForm({
    defaultValues: {
      roomNumber: "",
      lastName: "",
      firstName: "",
      lastNameKana: "",
      firstNameKana: "",
      lastNameRoman: "",
      firstNameRoman: "",
      gender: "男性",
      birthEra: "昭和",
      birthYear: "",
      birthMonth: "",
      birthDay: "",
      careLevel: "新規申請中",
      stomaManagement: false,
      isVisible: true,
      characterNotes: "",
      clinic1: "",
      clinic2: "",
      medicalHistory: "",
      doctorInstructions: "",
      keyPersonName: "",
      keyPersonRelation: "",
      keyPersonTel1: "",
      careManagerCompany: "",
      careManagerName: "",
    }
  });

  const onSubmit = (values: any) => {
    createMutation.mutate({
      data: {
        ...values,
        birthYear: Number(values.birthYear) || 1,
        birthMonth: Number(values.birthMonth) || 1,
        birthDay: Number(values.birthDay) || 1,
      }
    }, {
      onSuccess: () => {
        toast({ title: "保存しました" });
        setLocation("/residents");
      },
      onError: async (err: any) => {
        let msg = "エラーが発生しました";
        try {
          const json = await err?.response?.json?.();
          if (json?.error) msg = json.error;
        } catch {}
        toast({ title: msg, variant: "destructive" });
      },
    });
  };

  return (
    <Layout>
      <div className="space-y-6 max-w-3xl mx-auto">
        <div className="flex items-center gap-4">
          <Link href="/residents">
            <Button variant="ghost" size="icon">
              <ChevronLeft className="h-6 w-6" />
            </Button>
          </Link>
          <h1 className="text-2xl font-bold tracking-tight">利用者登録</h1>
        </div>

        <Card>
          <CardContent className="p-6">
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
              
              <div className="space-y-4">
                <h2 className="text-lg font-bold border-b pb-2">基本情報</h2>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>部屋番号</Label>
                    <Input {...form.register("roomNumber")} placeholder="101" />
                  </div>
                  <div className="space-y-2">
                    <Label>性別</Label>
                    <Controller
                      name="gender"
                      control={form.control}
                      render={({ field }) => (
                        <Select onValueChange={field.onChange} value={field.value}>
                          <SelectTrigger>
                            <SelectValue placeholder="選択" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="男性">男性</SelectItem>
                            <SelectItem value="女性">女性</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    />
                  </div>
                </div>

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
                  <div className="space-y-2">
                    <Label>姓 (ローマ字)</Label>
                    <Input {...form.register("lastNameRoman")} />
                  </div>
                  <div className="space-y-2">
                    <Label>名 (ローマ字)</Label>
                    <Input {...form.register("firstNameRoman")} />
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-4">
                  <div className="space-y-2">
                    <Label>元号</Label>
                    <Controller
                      name="birthEra"
                      control={form.control}
                      render={({ field }) => (
                        <Select onValueChange={field.onChange} value={field.value}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="明治">明治</SelectItem>
                            <SelectItem value="大正">大正</SelectItem>
                            <SelectItem value="昭和">昭和</SelectItem>
                            <SelectItem value="平成">平成</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>年</Label>
                    <Input type="number" {...form.register("birthYear")} placeholder="10" />
                  </div>
                  <div className="space-y-2">
                    <Label>月</Label>
                    <Input type="number" {...form.register("birthMonth")} placeholder="1" />
                  </div>
                  <div className="space-y-2">
                    <Label>日</Label>
                    <Input type="number" {...form.register("birthDay")} placeholder="1" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>介護度</Label>
                    <Controller
                      name="careLevel"
                      control={form.control}
                      render={({ field }) => (
                        <Select onValueChange={field.onChange} value={field.value}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="支1">支1</SelectItem>
                            <SelectItem value="支2">支2</SelectItem>
                            <SelectItem value="介1">介1</SelectItem>
                            <SelectItem value="介2">介2</SelectItem>
                            <SelectItem value="介3">介3</SelectItem>
                            <SelectItem value="介4">介4</SelectItem>
                            <SelectItem value="介5">介5</SelectItem>
                            <SelectItem value="新規申請中">新規申請中</SelectItem>
                            <SelectItem value="区分変更中">区分変更中</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    />
                  </div>
                  <div className="flex items-center space-x-2 pt-8">
                    <Controller
                      name="stomaManagement"
                      control={form.control}
                      render={({ field }) => (
                        <Switch checked={field.value} onCheckedChange={field.onChange} id="stomaManagement" />
                      )}
                    />
                    <Label htmlFor="stomaManagement">排泄管理あり</Label>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h2 className="text-lg font-bold border-b pb-2">医療・ケア情報</h2>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>クリニック 1</Label>
                    <Input {...form.register("clinic1")} />
                  </div>
                  <div className="space-y-2">
                    <Label>クリニック 2</Label>
                    <Input {...form.register("clinic2")} />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>既往歴</Label>
                  <Textarea {...form.register("medicalHistory")} className="h-20" />
                </div>
                
                <div className="space-y-2">
                  <Label>Dr.の指示</Label>
                  <Textarea {...form.register("doctorInstructions")} className="h-20" />
                </div>

                <div className="space-y-2">
                  <Label>どんな人物か</Label>
                  <Textarea {...form.register("characterNotes")} className="h-20" />
                </div>
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
