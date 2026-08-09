"use client";

import type { ReactNode } from "react";
import { Building2, Plus, type LucideIcon } from "lucide-react";

type ReferenceShellNavItem<T extends string> = {
  id: T;
  label: string;
  icon: LucideIcon;
};

export type ReferenceShellProps<T extends string> = {
  profileName: string;
  falLicense: string;
  tier: string;
  navItems: ReferenceShellNavItem<T>[];
  activeView: T;
  dashboardBadgeCount: number;
  mapViewId: T;
  clientsViewId: T;
  onNavigate: (view: T) => void;
  onQuickAdd: () => void;
  children: ReactNode;
  modals: ReactNode;
};

function mergeClasses(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export function ReferenceShell<T extends string>({
  profileName,
  falLicense,
  tier,
  navItems,
  activeView,
  dashboardBadgeCount,
  mapViewId,
  clientsViewId,
  onNavigate,
  onQuickAdd,
  children,
  modals,
}: ReferenceShellProps<T>) {
  const isMapPage = activeView === mapViewId;
  const mobileNavItems = navItems.filter((item) => item.id !== clientsViewId);

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#071224] text-slate-50">
      <aside className="fixed right-0 top-0 z-40 hidden h-screen w-64 flex-col border-l border-slate-700/40 bg-[#0c1a36] md:flex">
        <div className="border-b border-slate-700/40 p-5">
          <div className="flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-xl gold-gradient shadow-lg">
              <Building2 className="size-6 text-[#0f1f3d]" strokeWidth={2.4} aria-hidden="true" />
            </div>
            <div>
              <h1 className="text-lg font-extrabold leading-tight text-white">مفكرة الوسيط</h1>
              <p className="text-xs font-semibold text-[#c9972f]">العقاري 🏠</p>
            </div>
          </div>
        </div>

        <div className="px-4 py-3">
          <div className="rounded-xl border border-slate-700/55 bg-[#172641]/60 p-3">
            <p className="text-sm font-bold text-white">{profileName}</p>
            <p className="mt-0.5 text-xs text-slate-400">فال: {falLicense}</p>
            <span className="mt-1.5 inline-block rounded-full border border-[#c9972f]/30 bg-[#c9972f]/15 px-2 py-0.5 text-[11px] font-bold text-[#e5bc55]">
              {tier}
            </span>
          </div>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-3 scrollbar-thin">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeView === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onNavigate(item.id)}
                className={mergeClasses(
                  "flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-sm font-semibold transition-all",
                  isActive
                    ? "border-[#c9972f]/30 bg-[#c9972f]/15 text-[#e5bc55]"
                    : "border-transparent text-slate-400 hover:bg-[#172641]/70 hover:text-white",
                )}
              >
                <Icon className="size-5" aria-hidden="true" />
                <span>{item.label}</span>
                {item.id === navItems[0]?.id && dashboardBadgeCount > 0 ? (
                  <span className="ms-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[11px] font-bold text-white">
                    {dashboardBadgeCount}
                  </span>
                ) : null}
              </button>
            );
          })}
        </nav>

        <div className="border-t border-slate-700/40 p-4">
          <button
            type="button"
            onClick={onQuickAdd}
            className="flex w-full items-center justify-center gap-2 rounded-xl py-3.5 font-extrabold text-[#0f1f3d] shadow-lg transition-all hover:brightness-110 active:scale-[0.98] gold-gradient"
          >
            <Plus className="size-5" strokeWidth={3} aria-hidden="true" />
            إضافة سريعة
          </button>
        </div>
      </aside>

      <main className={mergeClasses("min-h-screen md:mr-64", isMapPage ? "" : "pb-24 md:pb-8")}>
        <div className={isMapPage || activeView === navItems[0]?.id ? "" : "mx-auto max-w-6xl p-4 md:p-6"}>{children}</div>
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-700/40 bg-[#0c1a36]/95 pb-safe shadow-2xl backdrop-blur md:hidden" aria-label="التنقل الرئيسي للجوال">
        <div className="grid h-16 grid-cols-5">
          {mobileNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeView === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onNavigate(item.id)}
                className={mergeClasses(
                  "relative flex flex-col items-center justify-center gap-0.5 text-[10px] font-bold transition-colors",
                  isActive ? "text-[#e5bc55]" : "text-slate-400",
                )}
              >
                {isActive ? <span className="absolute top-0 h-0.5 w-8 rounded-full bg-[#c9972f]" /> : null}
                <Icon className="size-5" aria-hidden="true" />
                <span>{item.label}</span>
                {item.id === navItems[0]?.id && dashboardBadgeCount > 0 ? (
                  <span className="absolute end-3 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-0.5 text-[9px] font-bold text-white">
                    {dashboardBadgeCount}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      </nav>

      {!isMapPage ? (
        <button
          type="button"
          onClick={onQuickAdd}
          aria-label="إضافة سريعة"
          className="fixed bottom-20 left-4 z-40 flex size-14 items-center justify-center rounded-full gold-gradient shadow-xl shadow-[#c9972f]/25 transition-transform active:scale-95 md:hidden"
        >
          <Plus className="size-7 text-[#0f1f3d]" strokeWidth={3} aria-hidden="true" />
        </button>
      ) : null}

      {modals}
    </div>
  );
}
