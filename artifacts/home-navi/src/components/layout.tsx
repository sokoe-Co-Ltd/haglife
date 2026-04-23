import React from "react";
import { Link, useLocation } from "wouter";
import {
  Home,
  FileText,
  Activity,
  Utensils,
  Weight,
  Baby,
  Briefcase,
  Stethoscope,
  Bath,
  Users,
  UserPlus,
  UserCircle,
  FileDown,
  Menu,
} from "lucide-react";
import logoSrc from "/logo.png";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

const NAV_ITEMS = [
  { href: "/", label: "ホーム", icon: Home },
  { href: "/handover", label: "申し送り", icon: FileText },
  { href: "/vitals", label: "バイタル", icon: Activity },
  { href: "/meals", label: "食事", icon: Utensils },
  { href: "/eliminations", label: "排泄", icon: Baby },
  { href: "/weights", label: "体重", icon: Weight },
  { href: "/day-services", label: "デイ準備物", icon: Briefcase },
  { href: "/bath-reports", label: "入浴報告", icon: Bath },
  { href: "/residents", label: "利用者一覧", icon: Users },
  { href: "/staff", label: "職員一覧", icon: UserCircle },
];

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();

  const NavLinks = () => (
    <>
      <div className="py-4 px-6 font-bold text-xl text-primary flex items-center gap-2">
        <img src={logoSrc} alt="Huglife ロゴ" className="h-8 w-auto" />
        ハグライフ南摂津
      </div>
      <nav className="space-y-1 px-2">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-4 py-3 rounded-md text-sm font-medium transition-colors ${
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground"
              }`}
            >
              <Icon className="h-5 w-5" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </>
  );

  return (
    <div className="flex min-h-screen bg-background">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-64 flex-col border-r bg-card h-screen sticky top-0">
        <NavLinks />
      </aside>

      {/* Mobile Header & Content */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="md:hidden flex items-center justify-between p-4 border-b bg-card sticky top-0 z-10">
          <div className="font-bold text-lg text-primary flex items-center gap-2">
            <img src={logoSrc} alt="Huglife ロゴ" className="h-7 w-auto" />
            ハグライフ南摂津
          </div>
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon">
                <Menu className="h-6 w-6" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="p-0 w-64">
              <NavLinks />
            </SheetContent>
          </Sheet>
        </header>
        
        <main className="flex-1 p-4 md:p-6 overflow-x-hidden">
          {children}
        </main>
      </div>
    </div>
  );
}
