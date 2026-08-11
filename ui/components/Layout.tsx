import { NavLink, Outlet, useLocation } from 'react-router';
import { Home, Tag, Inbox, Map as MapIcon, Users, UserCircle, Plus, Building2, FileText } from 'lucide-react';
import { useApp } from '@/ui/context/AppContext';
import { useDB } from '@/ui/lib/db';
import { isOverdue } from '@/ui/lib/db';
import { cn } from '@/ui/lib/utils';
import { QuickAddModal } from '@/ui/components/quick-add/QuickAddModal';
import { Toaster } from '@/ui/components/ui/sonner';

const NAV_ITEMS = [
  { to: '/', label: 'الرئيسية', icon: Home },
  { to: '/offers', label: 'العروض', icon: Tag },
  { to: '/requests', label: 'الطلبات', icon: Inbox },
  { to: '/map', label: 'الخريطة', icon: MapIcon },
  { to: '/contacts', label: 'العملاء', icon: Users },
  { to: '/documents', label: 'documents', icon: FileText },
  { to: '/account', label: 'حسابي', icon: UserCircle },
];

export function Layout() {
  const { openQuickAdd } = useApp();
  const { listings, profile } = useDB();
  const location = useLocation();
  const overdueCount = listings.filter(isOverdue).length;
  const isMapPage = location.pathname === '/map';

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* ===== Desktop: right-side persistent sidebar (RTL start) ===== */}
      <aside className="hidden md:flex fixed top-0 right-0 h-screen w-64 flex-col border-l border-border bg-[#0c1a36] z-40">
        <div className="p-5 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl gold-gradient flex items-center justify-center shadow-lg">
              <Building2 className="w-6 h-6 text-[#0f1f3d]" strokeWidth={2.4} />
            </div>
            <div>
              <h1 className="font-extrabold text-lg leading-tight text-white">مفكرة الوسيط</h1>
              <p className="text-xs text-[#c9972f] font-semibold">العقاري 🏡</p>
            </div>
          </div>
        </div>

        <div className="px-4 py-3">
          <div className="rounded-xl bg-secondary/60 border border-border p-3">
            <p className="font-bold text-sm text-white">{profile.name}</p>
            <p className="text-xs text-muted-foreground mt-0.5">فال: {profile.falLicense}</p>
            <span className="inline-block mt-1.5 text-[11px] font-bold px-2 py-0.5 rounded-full bg-[#c9972f]/15 text-[#e5bc55] border border-[#c9972f]/30">
              {profile.tier}
            </span>
          </div>
        </div>

        <nav className="flex-1 px-3 space-y-1 overflow-y-auto scrollbar-thin">
          {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all',
                  isActive
                    ? 'bg-[#c9972f]/15 text-[#e5bc55] border border-[#c9972f]/30'
                    : 'text-muted-foreground hover:bg-secondary/70 hover:text-white border border-transparent',
                )
              }
            >
              <Icon className="w-5 h-5" />
              <span>{label}</span>
              {to === '/' && overdueCount > 0 && (
                <span className="ms-auto min-w-5 h-5 px-1 rounded-full bg-red-500 text-white text-[11px] font-bold flex items-center justify-center">
                  {overdueCount}
                </span>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="p-4 border-t border-border">
          <button
            onClick={() => openQuickAdd('offer')}
            className="w-full gold-gradient text-[#0f1f3d] font-extrabold rounded-xl py-3.5 flex items-center justify-center gap-2 shadow-lg hover:brightness-110 active:scale-[0.98] transition-all"
          >
            <Plus className="w-5 h-5" strokeWidth={3} />
            إضافة سريعة
          </button>
        </div>
      </aside>

      {/* ===== Main content ===== */}
      <main
        className={cn(
          'md:mr-64 min-h-screen',
          isMapPage ? '' : 'pb-24 md:pb-8',
        )}
      >
        <Outlet />
      </main>

      {/* ===== Mobile: bottom navigation ===== */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-[#0c1a36]/95 backdrop-blur-lg border-t border-border pb-safe">
        <div className="grid grid-cols-6 h-16">
          {[
            NAV_ITEMS[0],
            NAV_ITEMS[1],
            NAV_ITEMS[2],
            NAV_ITEMS[3],
            NAV_ITEMS[5],
            NAV_ITEMS[6],
          ].map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                cn(
                  'flex flex-col items-center justify-center gap-0.5 text-[10px] font-bold transition-colors relative',
                  isActive ? 'text-[#e5bc55]' : 'text-muted-foreground',
                )
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && <span className="absolute top-0 w-8 h-0.5 rounded-full bg-[#c9972f]" />}
                  <Icon className="w-5 h-5" />
                  <span>{label}</span>
                  {to === '/' && overdueCount > 0 && (
                    <span className="absolute top-1.5 end-3 min-w-4 h-4 px-0.5 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center">
                      {overdueCount}
                    </span>
                  )}
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>

      {/* ===== Mobile: floating quick-add FAB ===== */}
      {!isMapPage && (
        <button
          onClick={() => openQuickAdd('offer')}
          aria-label="إضافة سريعة"
          className="md:hidden fixed bottom-20 left-4 z-40 w-14 h-14 rounded-full gold-gradient shadow-xl shadow-[#c9972f]/25 flex items-center justify-center active:scale-95 transition-transform"
        >
          <Plus className="w-7 h-7 text-[#0f1f3d]" strokeWidth={3} />
        </button>
      )}

      <QuickAddModal />
      <Toaster position="top-center" richColors theme="dark" />
    </div>
  );
}
