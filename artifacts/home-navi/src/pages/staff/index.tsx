import { Layout } from "@/components/layout";
import { useListStaff } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { UserCircle, Plus, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";

export default function StaffList() {
  const { data: staff, isLoading } = useListStaff();

  return (
    <Layout>
      <div className="max-w-3xl mx-auto space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <UserCircle className="h-5 w-5 text-primary" />
            職員一覧
            {staff && <span className="text-sm font-normal text-gray-500 ml-1">（{staff.length}名）</span>}
          </h1>
          <Link href="/staff/new">
            <Button size="sm" className="gap-1.5">
              <Plus className="h-4 w-4" />
              新規登録
            </Button>
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {isLoading ? (
            Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex gap-4 items-center">
                <Skeleton className="h-12 w-12 rounded-full" />
                <div className="space-y-2 flex-1">
                  <Skeleton className="h-4 w-1/2" />
                  <Skeleton className="h-3 w-1/3" />
                </div>
              </div>
            ))
          ) : (
            staff?.map((person) => (
              <div key={person.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-11 w-11 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-base shrink-0">
                    {person.lastName.charAt(0)}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-gray-800">{person.lastName} {person.firstName}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{person.role}</p>
                  </div>
                </div>
                {person.tel && (
                  <a href={`tel:${person.tel}`}>
                    <button className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center text-primary hover:bg-primary/20 transition-colors">
                      <Phone className="h-4 w-4" />
                    </button>
                  </a>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </Layout>
  );
}
