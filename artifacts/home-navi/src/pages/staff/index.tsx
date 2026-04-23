import { Layout } from "@/components/layout";
import { useListStaff } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { UserCircle, Plus, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";

export default function StaffList() {
  const { data: staff, isLoading } = useListStaff();

  return (
    <Layout>
      <div className="space-y-6 max-w-3xl mx-auto">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <UserCircle className="h-6 w-6" />
            職員一覧
          </h1>
          <Link href="/staff/new">
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              新規登録
            </Button>
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {isLoading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <Card key={i}>
                <CardContent className="p-4 flex gap-4">
                  <Skeleton className="h-12 w-12 rounded-full" />
                  <div className="space-y-2 flex-1">
                    <Skeleton className="h-4 w-1/2" />
                    <Skeleton className="h-4 w-1/3" />
                  </div>
                </CardContent>
              </Card>
            ))
          ) : (
            staff?.map((person) => (
              <Card key={person.id}>
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-lg">
                      {person.lastName.charAt(0)}
                    </div>
                    <div>
                      <div className="font-bold">{person.lastName} {person.firstName}</div>
                      <div className="text-sm text-muted-foreground">{person.role}</div>
                    </div>
                  </div>
                  {person.tel && (
                    <a href={`tel:${person.tel}`}>
                      <Button variant="ghost" size="icon" className="text-primary rounded-full">
                        <Phone className="h-5 w-5" />
                      </Button>
                    </a>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </Layout>
  );
}
