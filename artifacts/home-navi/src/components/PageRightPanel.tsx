import React from "react";
import { Link } from "wouter";
import { ChevronRight, LucideIcon } from "lucide-react";

export interface QuickAction {
  label: string;
  icon: LucideIcon;
  href?: string;
  onClick?: () => void;
  color?: string;
}

interface QuickActionsCardProps {
  actions: QuickAction[];
}

export function QuickActionsCard({ actions }: QuickActionsCardProps) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100">
        <h3 className="text-sm font-bold text-gray-700">クイック操作</h3>
      </div>
      <div className="divide-y divide-gray-50">
        {actions.map((action) => {
          const Icon = action.icon;
          const inner = (
            <span className="flex items-center gap-3 px-4 py-3 hover:bg-primary/5 transition-colors cursor-pointer w-full text-left">
              <span className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${action.color ?? "bg-primary/10"}`}>
                <Icon className={`h-4 w-4 ${action.color ? "text-white" : "text-primary"}`} />
              </span>
              <span className="text-sm text-gray-700 flex-1">{action.label}</span>
              <ChevronRight className="h-4 w-4 text-gray-300 shrink-0" />
            </span>
          );
          if (action.href) {
            return (
              <Link key={action.label} href={action.href} className="block">
                {inner}
              </Link>
            );
          }
          return (
            <button key={action.label} onClick={action.onClick} className="block w-full">
              {inner}
            </button>
          );
        })}
      </div>
    </div>
  );
}

interface StaffMemoCardProps {
  memo?: string;
  title?: string;
  showEdit?: boolean;
}

export function StaffMemoCard({ memo, title = "スタッフメモ", showEdit = true }: StaffMemoCardProps) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
        <h3 className="text-sm font-bold text-gray-700">{title}</h3>
        {showEdit && <button className="text-xs text-primary hover:underline">編集</button>}
      </div>
      <div className="px-4 py-3">
        <p className="text-xs text-gray-500 leading-relaxed">
          {memo ?? "声かけを意識して実施。体調の変化がないか注意深く観察をお願いします。"}
        </p>
      </div>
    </div>
  );
}

interface InfoCardProps {
  title: string;
  children: React.ReactNode;
  titleColor?: string;
  borderColor?: string;
}

export function InfoCard({ title, children, titleColor = "text-gray-700", borderColor = "border-gray-100" }: InfoCardProps) {
  return (
    <div className={`bg-white rounded-2xl shadow-sm border ${borderColor} overflow-hidden`}>
      <div className={`px-4 py-3 border-b ${borderColor}`}>
        <h3 className={`text-sm font-bold ${titleColor}`}>{title}</h3>
      </div>
      <div className="px-4 py-3">
        {children}
      </div>
    </div>
  );
}
