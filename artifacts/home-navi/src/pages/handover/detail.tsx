import { Layout } from "@/components/layout";
import { useGetHandoverNote } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle, Stethoscope, ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link, useParams } from "wouter";
import { format } from "date-fns";
import { ja } from "date-fns/locale";

export default function HandoverDetail() {
  const params = useParams();
  const id = parseInt(params.id || "0");
  const { data: note, isLoading } = useGetHandoverNote(id, { query: { enabled: !!id } });

  return (
    <Layout>
      <div className="space-y-6 max-w-2xl mx-auto">
        <div className="flex items-center gap-4">
          <Link href="/handover">
            <Button variant="ghost" size="icon">
              <ChevronLeft className="h-6 w-6" />
            </Button>
          </Link>
          <h1 className="text-2xl font-bold tracking-tight">申し送り詳細</h1>
        </div>

        {isLoading ? (
          <Card>
            <CardContent className="p-6 space-y-4">
              <Skeleton className="h-8 w-1/3" />
              <Skeleton className="h-4 w-1/4" />
              <Skeleton className="h-32 w-full" />
            </CardContent>
          </Card>
        ) : !note ? (
          <div className="text-center py-12 text-muted-foreground">見つかりませんでした</div>
        ) : (
          <Card>
            <CardHeader className="pb-3 border-b">
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-2">
                  <CardTitle className="text-xl">
                    {note.category === "利用者" ? note.residentName : "その他"}
                  </CardTitle>
                  {note.isImportant && (
                    <AlertCircle className="h-5 w-5 text-destructive" />
                  )}
                  {note.isDoctorReport && (
                    <Stethoscope className="h-5 w-5 text-primary" />
                  )}
                </div>
                <div className="text-sm text-muted-foreground text-right">
                  <div>{format(new Date(note.recordedAt), "yyyy/MM/dd HH:mm", { locale: ja })}</div>
                  <div>記入者: {note.authorName}</div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-6">
              <div className="whitespace-pre-wrap text-base leading-relaxed">
                {note.content}
              </div>
              
              {/* Note: Photos implementation would go here if we had actual photos to display */}
              {(note.photo1Url || note.photo2Url || note.photo3Url || note.photo4Url || note.photo5Url) && (
                <div className="mt-6 pt-6 border-t grid grid-cols-2 md:grid-cols-3 gap-2">
                  {note.photo1Url && <img src={note.photo1Url} alt="添付1" className="rounded-md object-cover aspect-square w-full" />}
                  {note.photo2Url && <img src={note.photo2Url} alt="添付2" className="rounded-md object-cover aspect-square w-full" />}
                  {note.photo3Url && <img src={note.photo3Url} alt="添付3" className="rounded-md object-cover aspect-square w-full" />}
                  {note.photo4Url && <img src={note.photo4Url} alt="添付4" className="rounded-md object-cover aspect-square w-full" />}
                  {note.photo5Url && <img src={note.photo5Url} alt="添付5" className="rounded-md object-cover aspect-square w-full" />}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </Layout>
  );
}
