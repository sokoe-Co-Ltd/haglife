import React, { useState, useRef, useEffect } from "react";
import { ChevronLeft, ChevronRight, Calendar, CalendarDays } from "lucide-react";
import { Calendar as CalendarPicker } from "@/components/ui/calendar";
import { format, addDays, subDays, addMonths, subMonths } from "date-fns";
import { ja } from "date-fns/locale";

// ---- Shared popup wrapper ----
function Popup({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  return (
    <div ref={ref} className="absolute top-full mt-2 left-1/2 -translate-x-1/2 z-50 bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
      {children}
    </div>
  );
}

// ---- Day picker ----
interface DayNavProps {
  date: Date;
  onChange: (d: Date) => void;
  maxDate?: Date;
}

export function DayNav({ date, onChange, maxDate }: DayNavProps) {
  const [open, setOpen] = useState(false);
  const today = new Date();
  const isToday = format(date, "yyyy-MM-dd") === format(today, "yyyy-MM-dd");
  const atMax = maxDate ? format(date, "yyyy-MM-dd") >= format(maxDate, "yyyy-MM-dd") : isToday;

  const dayLabel = isToday
    ? `今日（${format(date, "M月d日（E）", { locale: ja })}）`
    : format(date, "M月d日（E）", { locale: ja });

  return (
    <div className="relative flex items-center gap-1">
      <button
        onClick={() => onChange(subDays(date, 1))}
        className="h-8 w-8 flex items-center justify-center rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-500 transition-colors"
        aria-label="前の日"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>

      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-3 h-8 rounded-lg border border-gray-200 hover:bg-orange-50 hover:border-orange-300 transition-colors text-sm font-medium text-gray-700"
      >
        <CalendarDays className="h-4 w-4 text-orange-500" />
        {dayLabel}
      </button>

      <button
        onClick={() => !atMax && onChange(addDays(date, 1))}
        disabled={atMax}
        className={`h-8 w-8 flex items-center justify-center rounded-lg border border-gray-200 transition-colors ${atMax ? "text-gray-200 cursor-not-allowed" : "hover:bg-gray-50 text-gray-500"}`}
        aria-label="次の日"
      >
        <ChevronRight className="h-4 w-4" />
      </button>

      {!isToday && (
        <button
          onClick={() => onChange(today)}
          className="h-8 px-2 rounded-lg border border-orange-300 bg-orange-50 text-orange-600 text-xs font-medium hover:bg-orange-100 transition-colors"
        >
          今日
        </button>
      )}

      {open && (
        <Popup onClose={() => setOpen(false)}>
          <CalendarPicker
            mode="single"
            selected={date}
            onSelect={(d) => { if (d) { onChange(d); setOpen(false); } }}
            disabled={(d) => d > today}
            locale={ja}
            classNames={{
              day: "group/day relative aspect-square h-full w-full select-none p-0 text-center",
            }}
          />
          <div className="border-t border-gray-100 p-3">
            <button
              onClick={() => { onChange(today); setOpen(false); }}
              className="w-full py-3 text-base font-bold text-orange-600 hover:bg-orange-50 rounded-xl transition-colors"
            >
              今日に戻る
            </button>
          </div>
        </Popup>
      )}
    </div>
  );
}

// ---- Month picker ----
interface MonthNavProps {
  year: number;
  month: number;
  onChange: (year: number, month: number) => void;
}

const MONTHS = ["1月", "2月", "3月", "4月", "5月", "6月", "7月", "8月", "9月", "10月", "11月", "12月"];

export function MonthNav({ year, month, onChange }: MonthNavProps) {
  const [open, setOpen] = useState(false);
  const [pickerYear, setPickerYear] = useState(year);
  const today = new Date();
  const isCurrentMonth = year === today.getFullYear() && month === today.getMonth() + 1;

  const prev = () => {
    const d = subMonths(new Date(year, month - 1, 1), 1);
    onChange(d.getFullYear(), d.getMonth() + 1);
  };
  const next = () => {
    if (!isCurrentMonth) {
      const d = addMonths(new Date(year, month - 1, 1), 1);
      onChange(d.getFullYear(), d.getMonth() + 1);
    }
  };

  return (
    <div className="relative flex items-center gap-1">
      <button
        onClick={prev}
        className="h-8 w-8 flex items-center justify-center rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-500 transition-colors"
        aria-label="前の月"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>

      <button
        onClick={() => { setPickerYear(year); setOpen(!open); }}
        className="flex items-center gap-2 px-3 h-8 rounded-lg border border-gray-200 hover:bg-orange-50 hover:border-orange-300 transition-colors text-sm font-medium text-gray-700"
      >
        <Calendar className="h-4 w-4 text-orange-500" />
        {year}年{month}月
        {isCurrentMonth && <span className="text-xs text-orange-500">（今月）</span>}
      </button>

      <button
        onClick={next}
        disabled={isCurrentMonth}
        className={`h-8 w-8 flex items-center justify-center rounded-lg border border-gray-200 transition-colors ${isCurrentMonth ? "text-gray-200 cursor-not-allowed" : "hover:bg-gray-50 text-gray-500"}`}
        aria-label="次の月"
      >
        <ChevronRight className="h-4 w-4" />
      </button>

      {!isCurrentMonth && (
        <button
          onClick={() => onChange(today.getFullYear(), today.getMonth() + 1)}
          className="h-8 px-2 rounded-lg border border-orange-300 bg-orange-50 text-orange-600 text-xs font-medium hover:bg-orange-100 transition-colors"
        >
          今月
        </button>
      )}

      {open && (
        <Popup onClose={() => setOpen(false)}>
          <div className="p-5 min-w-[320px]">
            <div className="flex items-center justify-between mb-4">
              <button onClick={() => setPickerYear(y => y - 1)} className="p-2.5 rounded-xl hover:bg-gray-100 text-gray-500">
                <ChevronLeft className="h-6 w-6" />
              </button>
              <span className="text-xl font-bold text-gray-800">{pickerYear}年</span>
              <button
                onClick={() => setPickerYear(y => y + 1)}
                disabled={pickerYear >= today.getFullYear()}
                className={`p-2.5 rounded-xl transition-colors ${pickerYear >= today.getFullYear() ? "text-gray-200 cursor-not-allowed" : "hover:bg-gray-100 text-gray-500"}`}
              >
                <ChevronRight className="h-6 w-6" />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {MONTHS.map((label, i) => {
                const m = i + 1;
                const isFuture = pickerYear > today.getFullYear() || (pickerYear === today.getFullYear() && m > today.getMonth() + 1);
                const isSelected = pickerYear === year && m === month;
                return (
                  <button
                    key={m}
                    disabled={isFuture}
                    onClick={() => { onChange(pickerYear, m); setOpen(false); }}
                    className={`py-4 rounded-xl text-base font-bold transition-colors ${isFuture ? "text-gray-200 cursor-not-allowed" : isSelected ? "bg-orange-500 text-white" : "hover:bg-orange-50 text-gray-700"}`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
        </Popup>
      )}
    </div>
  );
}
