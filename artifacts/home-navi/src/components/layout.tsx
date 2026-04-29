import React, { useState, useRef, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { OfflineBannerSpacer } from "@/components/OfflineBanner";
import { useListHandoverNotes } from "@workspace/api-client-react";
import { format } from "date-fns";
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
  LogOut,
  DoorOpen,
  Circle,
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
  { href: "/residents/moved-out", label: "退去者情報", icon: DoorOpen },
];

const BOTTOM_NAV = [
  { href: "/", label: "ホーム", icon: Home },
  { href: "/vitals", label: "バイタル", icon: Activity },
  { href: "/meals", label: "食事", icon: Utensils },
  { href: "/weights", label: "体重", icon: Weight },
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

function HagulifeLogo({ size = 36 }: { size?: number }) {
  return (
    <img
      src="/logo.png"
      alt="ハグライフ南摂津"
      style={{ width: size, height: size, objectFit: "contain" }}
    />
  );
}

function NotificationPanel({ onClose }: { onClose: () => void }) {
  const todayStr = format(new Date(), "yyyy-MM-dd");
  const { data: notes } = useListHandoverNotes({ date: todayStr, limit: 100 });
  const panelRef = useRef<HTMLDivElement>(null);
  const pending = (notes ?? []).filter((n: any) => n.status !== "完了");

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [onClose]);

  return (
    <div
      ref={panelRef}
      className="absolute right-0 top-full mt-2 w-80 max-w-[calc(100vw-2rem)] bg-white rounded-2xl shadow-xl border border-gray-100 z-50 overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <Bell className="h-4 w-4 text-primary" />
          <span className="text-sm font-bold text-gray-800">未対応の申し送り</span>
        </div>
        {pending.length > 0 && (
          <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
            {pending.length}件
          </span>
        )}
      </div>

      {/* List */}
      <div className="max-h-72 overflow-y-auto divide-y divide-gray-50">
        {pending.length === 0 ? (
          <div className="py-8 text-center text-sm text-gray-400">
            未対応の申し送りはありません
          </div>
        ) : (
          pending.slice(0, 6).map((note: any) => (
            <Link
              key={note.id}
              href={`/handover/${note.id}`}
              onClick={onClose}
              className="flex items-start gap-2.5 px-4 py-3 hover:bg-gray-50 transition-colors block"
            >
              <Circle className="h-2 w-2 text-orange-400 shrink-0 mt-1.5 fill-orange-400" />
              <div className="flex-1 min-w-0">
                {note.residentName && (
                  <span className="text-xs font-bold text-primary mr-1.5">{note.residentName}</span>
                )}
                <span className="text-xs text-gray-500">{note.category}</span>
                {note.isImportant && (
                  <span className="ml-1.5 text-xs font-bold text-red-600">重要</span>
                )}
                <p className="text-sm text-gray-700 line-clamp-1 mt-0.5">{note.content}</p>
                <p className="text-xs text-gray-400 mt-0.5">{note.authorName}</p>
              </div>
            </Link>
          ))
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-gray-100 px-4 py-2.5">
        <Link
          href="/handover"
          onClick={onClose}
          className="flex items-center justify-center gap-1 text-sm font-semibold text-primary hover:text-primary/80 transition-colors"
        >
          申し送り一覧を見る
          <ChevronRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}

const SIDEBAR_W = 288; // w-72 = 288px
const EDGE_THRESHOLD = 30; // px from left edge to initiate open swipe

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [dragProgress, setDragProgress] = useState<number | null>(null);

  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const isHSwipe = useRef<boolean | null>(null);
  const canSwipe = useRef(false);

  // progress: 0 = fully closed, 1 = fully open
  const progress = dragProgress !== null ? dragProgress : mobileMenuOpen ? 1 : 0;
  const isDragging = dragProgress !== null;

  function isActive(href: string) {
    return location === href || (href !== "/" && location.startsWith(href));
  }

  function handleTouchStart(e: React.TouchEvent) {
    const x = e.touches[0].clientX;
    touchStartX.current = x;
    touchStartY.current = e.touches[0].clientY;
    isHSwipe.current = null;
    canSwipe.current = mobileMenuOpen || x <= EDGE_THRESHOLD;
  }

  function handleTouchMove(e: React.TouchEvent) {
    if (!canSwipe.current) return;
    const dx = e.touches[0].clientX - touchStartX.current;
    const dy = e.touches[0].clientY - touchStartY.current;

    if (isHSwipe.current === null) {
      if (Math.abs(dx) < 4 && Math.abs(dy) < 4) return;
      isHSwipe.current = Math.abs(dx) > Math.abs(dy);
    }
    if (!isHSwipe.current) return;

    if (!mobileMenuOpen) {
      if (dx <= 0) return;
      setDragProgress(Math.min(1, dx / SIDEBAR_W));
    } else {
      if (dx >= 0) return;
      setDragProgress(Math.max(0, 1 + dx / SIDEBAR_W));
    }
  }

  function handleTouchEnd() {
    if (dragProgress === null) return;
    const snap = dragProgress > 0.3;
    setDragProgress(null);
    setMobileMenuOpen(snap);
    canSwipe.current = false;
  }

  return (
    <div
      className="flex min-h-screen bg-[#F5F7FA]"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-56 flex-col bg-white border-r border-gray-100 shadow-sm h-screen sticky top-0 z-20">
        {/* Logo */}
        <div className="px-4 py-4 border-b border-gray-100">
          <Link href="/" className="flex items-center gap-2.5 hover:opacity-80 transition-opacity">
            <HagulifeLogo size={36} />
            <span className="font-bold text-[15px] text-gray-800 leading-tight whitespace-nowrap">
              ハグライフ南摂津
            </span>
          </Link>
        </div>

        {/* Nav items */}
        <nav className="flex-1 py-2 px-2 space-y-0.5 overflow-y-auto">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  active
                    ? "bg-primary text-white shadow-sm"
                    : "text-gray-600 hover:bg-primary/10 hover:text-primary"
                }`}
              >
                <Icon style={{ width: 17, height: 17 }} className="shrink-0" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* User profile */}
        <div className="border-t border-gray-100 px-3 py-3">
          <Link href="/staff" className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors">
            <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm shrink-0">
              田
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-800 truncate">山田 花子</p>
              <p className="text-xs text-gray-400">介護職員</p>
            </div>
            <ChevronRight className="h-4 w-4 text-gray-300" />
          </Link>
        </div>
      </aside>

      {/* Main area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top header bar — home page only */}
        {location === "/" && (
          <header className="bg-white border-b border-gray-100 shadow-sm sticky top-0 z-10">
            <div className="flex items-center justify-between px-4 md:px-6 h-14">
              {/* Mobile: Logo + Name */}
              <div className="flex items-center gap-2.5 md:hidden">
                <HagulifeLogo size={32} />
                <span className="font-bold text-base text-gray-800">ハグライフ南摂津</span>
              </div>

              {/* Desktop: Greeting */}
              <div className="hidden md:flex items-center gap-2 text-sm text-gray-600">
                <span className="text-yellow-400 text-base">☀</span>
                <span>
                  {getGreeting()}、<span className="font-semibold text-gray-800">山田 花子</span>さん
                </span>
              </div>

              <div className="flex items-center gap-2">
                {/* Date (desktop only) */}
                <span className="hidden md:flex items-center gap-1 text-sm text-gray-500">
                  <span className="text-base">📅</span>
                  {formatDate()}
                </span>

                {/* Notification bell */}
                <div className="relative">
                  <button
                    onClick={() => setNotifOpen((o) => !o)}
                    className={`relative p-2 rounded-lg transition-colors ${notifOpen ? "bg-primary/10 text-primary" : "hover:bg-gray-100 text-gray-500 hover:text-primary"}`}
                  >
                    <Bell className="h-5 w-5" />
                    <span className="absolute top-1.5 right-1.5 h-2 w-2 bg-red-500 rounded-full" />
                  </button>
                  {notifOpen && <NotificationPanel onClose={() => setNotifOpen(false)} />}
                </div>

                {/* Logout button (desktop only) */}
                <button className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 hover:text-gray-800 transition-colors">
                  <LogOut className="h-4 w-4" />
                  ログアウト
                </button>
              </div>
            </div>
          </header>
        )}

        {/* Page content */}
        <main className="flex-1 p-4 md:p-6 pb-20 md:pb-6 overflow-x-hidden">
          <OfflineBannerSpacer />
          {children}
        </main>

        {/* Mobile bottom navigation */}
        <nav className="fixed bottom-0 left-0 right-0 md:hidden bg-white border-t border-gray-100 shadow-[0_-2px_12px_rgba(0,0,0,0.06)] z-20">
          <div className="grid grid-cols-5 h-[60px] pb-safe">
            {/* Menu button — leftmost */}
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="flex flex-col items-center justify-center gap-1 text-gray-400"
            >
              <svg className="h-[24px] w-[24px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
              <span className="text-xs font-medium">メニュー</span>
            </button>
            {BOTTOM_NAV.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex flex-col items-center justify-center gap-1 relative"
                >
                  {active && (
                    <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-[3px] bg-primary rounded-b-full" />
                  )}
                  <Icon className={`h-[24px] w-[24px] transition-colors ${active ? "text-primary" : "text-gray-400"}`} />
                  <span className={`text-xs font-medium transition-colors ${active ? "text-primary" : "text-gray-400"}`}>
                    {item.label}
                  </span>
                </Link>
              );
            })}
          </div>
        </nav>

        {/* Mobile swipe drawer — always mounted, controlled by CSS transform */}
        <div
          className="fixed inset-0 z-30 md:hidden"
          style={{ pointerEvents: progress > 0 ? "auto" : "none" }}
        >
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black"
            style={{
              opacity: progress * 0.45,
              transition: isDragging ? "none" : "opacity 0.28s ease",
            }}
            onClick={() => setMobileMenuOpen(false)}
          />

          {/* Sidebar panel */}
          <div
            className="absolute left-0 top-0 bottom-0 w-72 bg-white shadow-xl flex flex-col"
            style={{
              transform: `translateX(${(progress - 1) * 100}%)`,
              transition: isDragging ? "none" : "transform 0.28s ease",
            }}
          >
            <div className="px-4 py-4 border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <HagulifeLogo size={32} />
                <span className="font-bold text-gray-800">ハグライフ南摂津</span>
              </div>
              <button onClick={() => setMobileMenuOpen(false)} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100">
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <nav className="flex-1 py-2 px-2 space-y-0.5 overflow-y-auto">
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
                        ? "bg-primary text-white"
                        : "text-gray-600 hover:bg-primary/10 hover:text-primary"
                    }`}
                  >
                    <Icon style={{ width: 17, height: 17 }} className="shrink-0" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
            <div className="border-t border-gray-100 px-3 py-3">
              <div className="flex items-center gap-3 p-2">
                <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
                  田
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-800">山田 花子</p>
                  <p className="text-xs text-gray-400">介護職員</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
