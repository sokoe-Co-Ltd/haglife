import { Layout } from "@/components/layout";
import { useListHandoverNotes } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { ja } from "date-fns/locale";
import { AlertCircle, Stethoscope, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";

export default function HandoverList() {
  const { data: notes, isLoading } = useListHandoverNotes();

  return (
    <Layout>
      <div className="space-y-6 max-w-3xl mx-auto">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold tracking-tight">申し送り</h1>
          <Link href="/handover/new">
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              新規作成
            </Button>
          </Link>
        </div>

        <div className="space-y-4">
          {isLoading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <Card key={i}>
                <CardContent className="p-4 space-y-2">
                  <Skeleton className="h-4 w-1/4" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-2/3" />
                </CardContent>
              </Card>
            ))
          ) : notes?.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground bg-card rounded-lg border">
              申し送りはまだありません
            </div>
          ) : (
            notes?.map((note) => (
              <Link key={note.id} href={`/handover/${note.id}`}>
                <Card className="cursor-pointer hover:bg-muted/50 transition-colors">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-lg text-primary">
                          {note.category === "利用者" ? note.residentName : "その他"}
                        </span>
                        {note.isImportant && (
                          <AlertCircle className="h-5 w-5 text-destructive" />
                        )}
                        {note.isDoctorReport && (
                          <Stethoscope className="h-5 w-5 text-primary" />
                        )}
                      </div>
                      <span className="text-sm text-muted-foreground">
                        {format(new Date(note.recordedAt), "MM/dd HH:mm", { locale: ja })}
                      </span>
                    </div>
                    <p className="text-sm line-clamp-2 mb-2">{note.content}</p>
                    <div className="text-xs text-muted-foreground text-right">
                      記入者: {note.authorName}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))
          )}
        </div>
      </div>
    </Layout>
  );
}
