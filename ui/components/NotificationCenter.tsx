import { Bell, CheckCheck } from 'lucide-react';
import { db, useDB } from '@/ui/lib/db';
import { fmtDateTime } from '@/ui/lib/format';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/ui/components/ui/dialog';

export function NotificationCenter({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { notifications } = useDB();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-[#0f1f3d] border-[#c9972f]/25 text-white max-h-[80vh] overflow-y-auto scrollbar-thin">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg font-extrabold"><Bell className="w-5 h-5 text-[#e5bc55]" />مركز الإشعارات</DialogTitle>
        </DialogHeader>
        <button onClick={() => db.markAllNotificationsRead()} className="ms-auto flex items-center gap-1.5 text-xs font-extrabold text-[#e5bc55]"><CheckCheck className="w-4 h-4" />تعليم الكل كمقروء</button>
        <div className="space-y-2 mt-2">
          {notifications.map((item) => (
            <div key={item.id} className={`rounded-xl border p-3 ${item.read ? 'border-border bg-secondary/30' : 'border-[#c9972f]/35 bg-[#c9972f]/10'}`}>
              <p className="text-sm font-bold text-white">{item.title}</p>
              <p className="text-xs leading-6 text-slate-300 mt-1">{item.body.replace(/\s*\[[^\]]+\]$/, '')}</p>
              <p className="text-[10px] text-muted-foreground mt-1">{fmtDateTime(item.createdAt)}</p>
            </div>
          ))}
          {notifications.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">لا توجد إشعارات.</p>}
        </div>
      </DialogContent>
    </Dialog>
  );
}
