import { useState } from 'react';
import { Pencil, Save } from 'lucide-react';
import type { Listing } from '@/ui/types';
import { db } from '@/ui/lib/db';
import { DraftEditor, type Draft } from '@/ui/components/quick-add/DraftEditor';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/ui/components/ui/dialog';
import { toast } from 'sonner';

function toDraft(listing: Listing): Draft {
  return {
    kind: listing.kind,
    status: listing.status,
    propertyType: listing.propertyType,
    category: listing.category,
    title: listing.title,
    titleTouched: true,
    city: listing.city,
    district: listing.district,
    priceAsk: listing.priceAsk,
    priceBid: listing.priceBid,
    priceMode: listing.priceMode,
    lat: listing.lat,
    lng: listing.lng,
    fields: { ...listing.fields },
    falLicense: listing.falLicense,
    adLicense: listing.adLicense,
    ownerName: listing.ownerName,
    ownerPhone: listing.ownerPhone,
    clientName: listing.clientName,
    clientPhone: listing.clientPhone,
    images: [...listing.images],
    notes: listing.notes,
    source: listing.source,
    rawText: listing.rawText,
    refreshIntervalDays: listing.refreshIntervalDays,
  };
}

export function EditListingDialog({ listing, open, onOpenChange }: { listing: Listing; open: boolean; onOpenChange: (open: boolean) => void }) {
  const [draft, setDraft] = useState(() => toDraft(listing));
  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) setDraft(toDraft(listing));
    onOpenChange(nextOpen);
  };
  const save = () => {
    if (!draft.title.trim() || !draft.lat || !draft.lng) {
      toast.error('العنوان والموقع على الخريطة مطلوبان.');
      return;
    }
    const { titleTouched: _titleTouched, priceAmbiguous: _priceAmbiguous, ...patch } = draft;
    void _titleTouched; void _priceAmbiguous;
    db.updateListing(listing.id, { ...patch, status: patch.status as Listing['status'], title: patch.title.trim() }, 'تم تحديث بيانات الإعلان');
    toast.success('تم حفظ التعديلات');
    handleOpenChange(false);
  };
  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl w-[calc(100vw-1rem)] bg-[#0f1f3d] border-[#c9972f]/25 text-white max-h-[92vh] overflow-hidden flex flex-col p-0 gap-0">
        <DialogHeader className="px-5 py-4 border-b border-border"><DialogTitle className="flex items-center gap-2 text-lg font-extrabold"><Pencil className="w-5 h-5 text-[#e5bc55]" />تعديل الإعلان</DialogTitle></DialogHeader>
        <div className="flex-1 overflow-y-auto scrollbar-thin px-5 py-4"><DraftEditor draft={draft} onChange={setDraft} /></div>
        <div className="border-t border-border bg-[#0c1a36] p-3"><button onClick={save} className="w-full gold-gradient text-[#0f1f3d] rounded-xl py-3 font-extrabold flex items-center justify-center gap-2"><Save className="w-5 h-5" />حفظ التعديلات</button></div>
      </DialogContent>
    </Dialog>
  );
}
