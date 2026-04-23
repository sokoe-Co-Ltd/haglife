import React, { useState } from "react";
import { Link, useLocation } from "wouter";
import {
  Home,
  FileText,
  Activity,
  Utensils,
  Weight,
  Baby,
  Briefcase,
  Bath,
  Users,
  UserCircle,
  Bell,
  ChevronRight,
  ClipboardList,
} from "lucide-react";

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

const BOTTOM_NAV = [
  { href: "/", label: "ホーム", icon: Home },
  { href: "/handover", label: "申し送り", icon: FileText },
  { href: "/vitals", label: "記録", icon: ClipboardList },
  { href: "/residents", label: "利用者", icon: Users },
];

function formatDate() {
  const now = new Date();
  const days = ["日", "月", "火", "水", "木", "金", "土"];
  const y = now.getFullYear();
  const m = now.getMonth() + 1;
  const d = now.getDate();
  const dow = days[now.getDay()];
  return `${y}年${m}月${d}日（${dow}）`;
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 10) return "おはようございます";
  if (h < 17) return "こんにちは";
  return "お疲れさまです";
}

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  function isActive(href: string) {
    return location === href || (href !== "/" && location.startsWith(href));
  }

  return (
    <div className="flex min-h-screen bg-[#F5F7FA]">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-60 flex-col bg-white border-r border-gray-100 shadow-sm h-screen sticky top-0 z-20">
        {/* Logo */}
        <div className="px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2.5">
            <img src="/logo.png" alt="ハグライフ南摂津" className="h-9 w-9 object-contain" />
            <span className="font-bold text-base text-gray-800 leading-tight">
              ハグライフ<br />南摂津
            </span>
          </div>
        </div>

        {/* Nav items */}
        <nav className="flex-1 py-3 px-3 space-y-0.5 overflow-y-auto">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  active
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-gray-600 hover:bg-primary/10 hover:text-primary"
                }`}
              >
                <Icon className="h-4.5 w-4.5 shrink-0" style={{ width: 18, height: 18 }} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* User profile */}
        <div className="border-t border-gray-100 px-4 py-3">
          <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 cursor-pointer">
            <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm shrink-0">
              職
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-800 truncate">スタッフ</p>
              <p className="text-xs text-gray-500">介護職員</p>
            </div>
            <ChevronRight className="h-4 w-4 text-gray-400" />
          </div>
        </div>
      </aside>

      {/* Main area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top header bar */}
        <header className="bg-white border-b border-gray-100 shadow-sm sticky top-0 z-10">
          <div className="flex items-center justify-between px-4 md:px-6 h-14">
            {/* Mobile: Logo + Name */}
            <div className="flex items-center gap-2 md:hidden">
              <img src="/logo.png" alt="" className="h-7 w-7 object-contain" />
              <span className="font-bold text-sm text-gray-800">ハグライフ南摂津</span>
            </div>

            {/* Desktop: Greeting */}
            <div className="hidden md:flex items-center gap-2 text-sm text-gray-600">
              <span className="text-yellow-500 text-lg">☀</span>
              <span>
                {getGreeting()}、<span className="font-semibold text-gray-800">スタッフ</span>さん
              </span>
            </div>

            <div className="flex items-center gap-3">
              {/* Date (desktop only) */}
              <span className="hidden md:flex items-center gap-1.5 text-sm text-gray-500">
                <span className="text-base">📅</span>
                {formatDate()}
              </span>

              {/* Notification bell */}
              <button className="relative p-2 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-primary transition-colors">
                <Bell className="h-5 w-5" />
                <span className="absolute top-1.5 right-1.5 h-2 w-2 bg-red-500 rounded-full" />
              </button>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 p-4 md:p-6 pb-20 md:pb-6 overflow-x-hidden">
          {children}
        </main>

        {/* Mobile bottom navigation */}
        <nav className="fixed bottom-0 left-0 right-0 md:hidden bg-white border-t border-gray-200 shadow-lg z-20">
          <div className="grid grid-cols-5 h-16">
            {BOTTOM_NAV.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex flex-col items-center justify-center gap-1 text-xs font-medium transition-colors ${
                    active ? "text-primary" : "text-gray-500"
                  }`}
                >
                  <Icon className={`h-5 w-5 ${active ? "text-primary" : "text-gray-400"}`} />
                  {item.label}
                </Link>
              );
            })}
            {/* Menu button opens overlay */}
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="flex flex-col items-center justify-center gap-1 text-xs font-medium text-gray-500"
            >
              <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
              メニュー
            </button>
          </div>
        </nav>

        {/* Mobile full menu overlay */}
        {mobileMenuOpen && (
          <div className="fixed inset-0 z-30 md:hidden">
            <div className="absolute inset-0 bg-black/40" onClick={() => setMobileMenuOpen(false)} />
            <div className="absolute left-0 top-0 bottom-0 w-72 bg-white shadow-xl flex flex-col">
              <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <img src="/logo.png" alt="" className="h-8 w-8 object-contain" />
                  <span className="font-bold text-gray-800">ハグライフ南摂津</span>
                </div>
                <button onClick={() => setMobileMenuOpen(false)} className="p-1 rounded text-gray-500 hover:bg-gray-100">
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <nav className="flex-1 py-3 px-3 space-y-0.5 overflow-y-auto">
                {NAV_ITEMS.map((item) => {
                  const Icon = item.icon;
                  const active = isActive(item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMobileMenuOpen(false)}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                        active
                          ? "bg-primary text-primary-foreground"
                          : "text-gray-600 hover:bg-primary/10 hover:text-primary"
                      }`}
                    >
                      <Icon style={{ width: 18, height: 18 }} className="shrink-0" />
                      {item.label}
                    </Link>
                  );
                })}
              </nav>
              <div className="border-t border-gray-100 px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
                    職
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-800">スタッフ</p>
                    <p className="text-xs text-gray-500">介護職員</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
