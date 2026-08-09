"use client";

import type { ReactNode } from "react";
import {
  Activity as ActivityIcon,
  CalendarClock,
  ChevronLeft,
  CircleDollarSign,
  History,
  Inbox,
  Plus,
  Tag,
  type LucideIcon,
} from "lucide-react";

type ReferenceKpi = {
  label: string;
  value: string | number;
  icon: LucideIcon;
  tone: "emerald" | "violet" | "red" | "gold";
  onClick: () => void;
};

type ReferenceOverdue = {
  id: string;
  title: string;
  contactName: string;
  canMessage: boolean;
  onMessage: () => void;
  onRefresh: () => void;
};

type ReferenceAction = {
  label: string;
  icon: string;
  onClick: () => void;
};

type ReferenceActivity = {
  id: string;
  icon: string;
  title: string;
  detail: string;
  time: string;
};

export type ReferenceDashboardProps = {
  greeting: string;
  profileName: string;
  tier: string;
  falLicense: string;
  kpis: ReferenceKpi[];
  overdue: ReferenceOverdue[];
  quickActions: ReferenceAction[];
  latestRecords: ReactNode[];
  activities: ReferenceActivity[];
  totalCommission: string | null;
  onQuickAdd: () => void;
  onViewOffers: () => void;
  onViewAccount: () => void;
};

const toneClass: Record<ReferenceKpi["tone"], string> = {
  emerald: "text-emerald-300 bg-emerald-500/10 border-emerald-500/25",
  violet: "text-violet-300 bg-violet-500/10 border-violet-500/25",
  red: "text-red-300 bg-red-500/10 border-red-500/25",
  gold: "text-[#e5bc55] bg-[#c9972f]/10 border-[#c9972f]/25",
};

export function ReferenceDashboard({
  greeting,
  profileName,
  tier,
  falLicense,
  kpis,
  overdue,
  quickActions,
  latestRecords,
  activities,
  totalCommission,
  onQuickAdd,
  onViewOffers,
  onViewAccount,
}: ReferenceDashboardProps) {
  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-5 md:py-8">
      <header className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-[#c9972f]">{greeting}</p>
          <h1 className="mt-0.5 text-2xl font-extrabold text-white md:text-3xl">{profileName}</h1>
          <p className="mt-1 text-sm text-slate-400">
            {tier} • رخصة فال {falLicense}
          </p>
        </div>
        <button
          type="button"
          onClick={onQuickAdd}
          className="hidden items-center gap-2 rounded-xl px-5 py-3 font-extrabold text-[#0f1f3d] shadow-lg transition-all hover:brightness-110 active:scale-[0.98] sm:flex gold-gradient"
        >
          <Plus className="size-5" strokeWidth={3} aria-hidden="true" />
          إضافة سريعة
        </button>
      </header>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {kpis.map(({ label, value, icon: Icon, tone, onClick }) => (
          <button
            key={label}
            type="button"
            onClick={onClick}
            className="rounded-2xl border border-slate-700/50 bg-[#0f1f3d] p-4 text-start transition-transform hover:-translate-y-0.5 card-glow"
          >
            <div className={`mb-3 flex size-10 items-center justify-center rounded-xl border ${toneClass[tone]}`}>
              <Icon className="size-5" aria-hidden="true" />
            </div>
            <p className="text-xl font-extrabold text-white nums-latin md:text-2xl">{value}</p>
            <p className="mt-0.5 text-xs font-semibold text-slate-400">{label}</p>
          </button>
        ))}
      </div>

      {overdue.length > 0 && (
        <section className="rounded-2xl border border-red-500/30 bg-red-500/5 p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-2 font-extrabold text-red-300">
              <CalendarClock className="size-5" aria-hidden="true" />
              إعلانات تجاوزت موعد تحديثها ({overdue.length})
            </h2>
          </div>
          <div className="space-y-2">
            {overdue.map((record) => (
              <div key={record.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-red-500/20 bg-[#0f1f3d] px-3.5 py-2.5">
                <span className="min-w-40 flex-1 truncate text-sm font-bold text-white">{record.title}</span>
                <span className="text-[11px] text-slate-400">{record.contactName}</span>
                <div className="ms-auto flex gap-1.5">
                  <button
                    type="button"
                    disabled={!record.canMessage}
                    onClick={record.onMessage}
                    className="rounded-lg bg-emerald-600 px-2.5 py-1.5 text-[11px] font-bold text-white transition-colors hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    مراسلة لتحديث العقار
                  </button>
                  <button
                    type="button"
                    onClick={record.onRefresh}
                    className="rounded-lg border border-slate-700/60 bg-[#172641]/70 px-2.5 py-1.5 text-[11px] font-bold text-slate-200 transition-colors hover:border-emerald-500/40"
                  >
                    تم التحديث
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {quickActions.map((action) => (
          <button
            key={action.label}
            type="button"
            onClick={action.onClick}
            className="rounded-2xl border border-slate-700/50 bg-[#0f1f3d] p-4 text-center transition-all hover:-translate-y-0.5 hover:border-[#c9972f]/40 card-glow"
          >
            <span className="text-2xl">{action.icon}</span>
            <p className="mt-1.5 text-sm font-bold text-slate-200">{action.label}</p>
          </button>
        ))}
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-2 font-extrabold text-white">
              <ActivityIcon className="size-5 text-[#c9972f]" aria-hidden="true" />
              أحدث الإعلانات
            </h2>
            <button type="button" onClick={onViewOffers} className="flex items-center gap-0.5 text-xs font-bold text-[#e5bc55] hover:underline">
              عرض الكل
              <ChevronLeft className="size-3.5" aria-hidden="true" />
            </button>
          </div>
          <div className="space-y-3">
            {latestRecords.length > 0 ? latestRecords : <p className="py-8 text-center text-sm text-slate-400">لا توجد إعلانات بعد - أضف أول إعلان</p>}
          </div>
        </section>

        <section>
          <h2 className="mb-3 flex items-center gap-2 font-extrabold text-white">
            <History className="size-5 text-[#c9972f]" aria-hidden="true" />
            سجل النشاط
          </h2>
          <div className="max-h-[520px] overflow-y-auto rounded-2xl border border-slate-700/50 bg-[#0f1f3d] divide-y divide-slate-700/50 scrollbar-thin card-glow">
            {activities.length > 0 ? (
              activities.map((activity) => (
                <div key={activity.id} className="flex items-start gap-3 px-4 py-3">
                  <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-lg border border-[#c9972f]/25 bg-[#c9972f]/10 text-xs font-bold text-[#e5bc55]">
                    {activity.icon}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold leading-snug text-slate-100">{activity.title}</p>
                    {activity.detail ? <p className="mt-0.5 truncate text-[11px] text-[#e5bc55]/80">{activity.detail}</p> : null}
                    <p className="mt-0.5 text-[10px] text-slate-500">{activity.time}</p>
                  </div>
                </div>
              ))
            ) : (
              <p className="py-8 text-center text-sm text-slate-400">لا يوجد نشاط بعد</p>
            )}
          </div>
        </section>
      </div>

      {totalCommission && (
        <section className="flex items-center justify-between rounded-2xl border border-[#c9972f]/30 p-4 navy-gradient">
          <div>
            <p className="text-xs font-semibold text-slate-400">إجمالي العمولات المحققة</p>
            <p className="mt-0.5 text-2xl font-extrabold text-[#e5bc55] nums-latin">{totalCommission}</p>
          </div>
          <button type="button" onClick={onViewAccount} className="text-xs font-bold text-[#e5bc55] hover:underline">
            التفاصيل المالية
          </button>
        </section>
      )}
    </div>
  );
}

export const referenceDashboardIcons = {
  Tag,
  Inbox,
  CalendarClock,
  CircleDollarSign,
};
