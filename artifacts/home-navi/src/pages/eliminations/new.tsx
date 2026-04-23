import { Layout } from "@/components/layout";
import { useCreateElimination, useGetResident } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ChevronLeft } from "lucide-react";
import { Link, useParams, useLocation } from "wouter";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm, Controller } from "react-hook-form";
import { useToast } from "@/hooks/use-toast";

export default function EliminationsNew() {
  const params = useParams();
  const residentId = parseInt(params.residentId || "0");
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  const { data: resident } = useGetResident(residentId, { query: { enabled: !!residentId } });
  const createMutation = useCreateElimination();

  const form = useForm({
    defaultValues: {
      type: "便",
      amount: "中",
      notes: "",
    }
  });

  const onSubmit = (values: any) => {
    createMutation.mutate({
      data: {
        residentId,
        type: values.type,
        amount: values.amount,
        notes: values.notes,
      }
    }, {
      onSuccess: () => {
        toast({ title: "保存しました" });
        setLocation("/eliminations");
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
          <Link href="/eliminations">
            <Button variant="ghost" size="icon">
              <ChevronLeft className="h-6 w-6" />
            </Button>
          </Link>
          <h1 className="text-2xl font-bold tracking-tight">排泄記録</h1>
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
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>種類</Label>
                  <Controller
                    name="type"
                    control={form.control}
                    render={({ field }) => (
                      <Select onValueChange={field.onChange} value={field.value}>
                        <SelectTrigger>
                          <SelectValue placeholder="種類を選択" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="尿">尿</SelectItem>
                          <SelectItem value="便">便</SelectItem>
                          <SelectItem value="入浴時">入浴時</SelectItem>
                          <SelectItem value="その他">その他</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>
                <div className="space-y-2">
                  <Label>量</Label>
                  <Controller
                    name="amount"
                    control={form.control}
                    render={({ field }) => (
                      <Select onValueChange={field.onChange} value={field.value}>
                        <SelectTrigger>
                          <SelectValue placeholder="量を選択" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="多">多</SelectItem>
                          <SelectItem value="中">中</SelectItem>
                          <SelectItem value="少">少</SelectItem>
                          <SelectItem value="無">無</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>備考 (聞き取り内容など)</Label>
                <Textarea {...form.register("notes")} placeholder="特記事項" className="h-32" />
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
