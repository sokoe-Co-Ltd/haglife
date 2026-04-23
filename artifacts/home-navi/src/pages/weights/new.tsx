import { Layout } from "@/components/layout";
import { useCreateWeight, useGetResident } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ChevronLeft } from "lucide-react";
import { Link, useParams, useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { useToast } from "@/hooks/use-toast";

export default function WeightsNew() {
  const params = useParams();
  const residentId = parseInt(params.residentId || "0");
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  const { data: resident } = useGetResident(residentId, { query: { enabled: !!residentId } });
  const createMutation = useCreateWeight();

  const form = useForm({
    defaultValues: {
      weightKg: "",
      notes: "",
    }
  });

  const onSubmit = (values: any) => {
    createMutation.mutate({
      data: {
        residentId,
        weightKg: Number(values.weightKg),
        notes: values.notes,
      }
    }, {
      onSuccess: () => {
        toast({ title: "保存しました" });
        setLocation("/weights");
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
          <Link href="/weights">
            <Button variant="ghost" size="icon">
              <ChevronLeft className="h-6 w-6" />
            </Button>
          </Link>
          <h1 className="text-2xl font-bold tracking-tight">体重記録</h1>
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
              
              <div className="space-y-2">
                <Label>体重 (kg)</Label>
                <Input type="number" step="0.1" {...form.register("weightKg")} placeholder="60.5" required />
              </div>

              <div className="space-y-2">
                <Label>備考</Label>
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
