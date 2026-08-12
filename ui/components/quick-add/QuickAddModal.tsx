import { useEffect, useRef, useState } from 'react';
import { Keyboard, MessageSquareText, Mic, MicOff, ArrowRight, Save, Sparkles, CheckCircle2 } from 'lucide-react';
import { useApp } from '@/ui/context/AppContext';
import { db } from '@/ui/lib/db';
import { normalizeArabic, parseListingText, type ParsedListing } from '@/ui/lib/parser';
import { extractPropertyWithServerAI, parsedListingFromServerAI, transcribeWithServerAI } from '@/ui/lib/server-ai';
import { PROPERTY_TYPE_LABELS, type Listing } from '@/ui/types';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/ui/components/ui/dialog';
import { cn } from '@/ui/lib/utils';
import { autoTitle, emptyDraft, DraftEditor, type Draft } from './DraftEditor';
import { toast } from 'sonner';
import { extractGoogleMapsUrl, parseCoordinatesFromGoogleMapsUrl } from '@/lib/google-maps';

type Tab = 'manual' | 'paste' | 'voice';
type Step = 'input' | 'review';

const TABS: Array<{ key: Tab; label: string; icon: typeof Keyboard; hint: string }> = [
  { key: 'manual', label: 'إدخال يدوي', icon: Keyboard, hint: 'اختر النوع وعبّئ الحقول' },
  { key: 'paste', label: 'لصق واتساب', icon: MessageSquareText, hint: 'حلّل نص إعلان جاهز' },
  { key: 'voice', label: 'إدخال صوتي', icon: Mic, hint: 'تحدث وسنستخرج البيانات' },
];

function inferTitleTypeLabel(rawText: string, draft: Draft): string | undefined {
  const custom = typeof draft.fields.customPropertyType === 'string' ? draft.fields.customPropertyType.trim() : '';
  if (custom) return custom.split(/\s+/).slice(0, 3).join(' ');

  const text = normalizeArabic(rawText).replace(/\s+/g, ' ');
  const matches: Array<[RegExp, string]> = [
    [/مبن[ىي]\s+مكتبي/, 'مبنى مكتبي'],
    [/برجين/, 'برجين'],
    [/ابراج/, 'أبراج'],
    [/شقتين/, 'شقتين'],
    [/شقق/, 'شقق'],
    [/فلتين|فيلتين|فيلاين/, 'فلتين'],
    [/فلل/, 'فلل'],
    [/عمارتين/, 'عمارتين'],
    [/عمائر/, 'عمائر'],
    [/مزرعتين/, 'مزرعتين'],
    [/مزارع/, 'مزارع'],
  ];
  return matches.find(([pattern]) => pattern.test(text))?.[1];
}

async function draftWithGoogleMapsPin(draft: Draft, rawText: string): Promise<Draft> {
  if (draft.lat && draft.lng) return draft;
  const mapUrl = extractGoogleMapsUrl(rawText);
  if (!mapUrl) return draft;

  const direct = parseCoordinatesFromGoogleMapsUrl(mapUrl);
  if (direct) return { ...draft, lat: direct.lat, lng: direct.lng, fields: { ...draft.fields, googleMapsUrl: mapUrl } };

  try {
    const response = await fetch('/api/resolve-map-url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: mapUrl }),
    });
    const body = (await response.json().catch(() => null)) as { lat?: number; lng?: number; resolvedUrl?: string } | null;
    if (response.ok && typeof body?.lat === 'number' && typeof body.lng === 'number') {
      return { ...draft, lat: body.lat, lng: body.lng, fields: { ...draft.fields, googleMapsUrl: body.resolvedUrl ?? mapUrl } };
    }
  } catch {
    // Keep the listing usable even if Google short-link resolution is temporarily unavailable.
  }
  return { ...draft, fields: { ...draft.fields, googleMapsUrl: mapUrl } };
}

function draftFromParsed(parsed: ParsedListing, source: 'whatsapp' | 'voice', rawText: string, fallbackKind: 'offer' | 'request'): Draft {
  const base = emptyDraft(parsed.kind ?? fallbackKind, source);
  const draft: Draft = {
    ...base,
    kind: parsed.kind,
    status: parsed.status,
    propertyType: parsed.propertyType,
    category: parsed.category,
    district: parsed.district,
    city: parsed.city || base.city,
    fields: parsed.fields,
    priceMode: parsed.priceMode,
    priceAmbiguous: parsed.priceAmbiguous,
    rawText,
  };
  if ('adLicense' in parsed && typeof parsed.adLicense === 'string') draft.adLicense = parsed.adLicense;
  if ('falLicense' in parsed && typeof parsed.falLicense === 'string') draft.falLicense = parsed.falLicense;
  if ('category' in parsed && typeof parsed.category === 'string') draft.category = parsed.category;
  if ('notes' in parsed && typeof parsed.notes === 'string') draft.notes = parsed.notes;
  if ('contactNumber' in parsed && typeof parsed.contactNumber === 'string') {
    if (draft.kind === 'offer') draft.ownerPhone = parsed.contactNumber;
    else draft.clientPhone = parsed.contactNumber;
  }
  if ('contactName' in parsed && typeof parsed.contactName === 'string') {
    if (draft.kind === 'offer') draft.ownerName = parsed.contactName;
    else draft.clientName = parsed.contactName;
  }
  if (parsed.priceBid !== undefined) draft.priceBid = parsed.priceBid;
  if (parsed.priceAsk !== undefined) draft.priceAsk = parsed.priceAsk;
  draft.title = autoTitle(draft, inferTitleTypeLabel(rawText, draft));
  return draft;
}

export function QuickAddModal() {
  const { quickAddOpen, closeQuickAdd, quickAddDefaultKind } = useApp();
  const [tab, setTab] = useState<Tab>('manual');
  const [step, setStep] = useState<Step>('input');
  const [draft, setDraft] = useState<Draft>(() => emptyDraft(quickAddDefaultKind, 'manual'));
  const [parsed, setParsed] = useState<ParsedListing | null>(null);

  // paste / voice state
  const [pasteText, setPasteText] = useState('');
  const [voiceText, setVoiceText] = useState('');
  const [listening, setListening] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(true);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiProgress, setAiProgress] = useState('');
  const recognitionRef = useRef<{ stop: () => void } | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // reset when opened
  useEffect(() => {
    if (quickAddOpen) {
      // The reference modal resets its complete draft whenever it opens.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setTab('manual');
      setStep('input');
      setDraft(emptyDraft(quickAddDefaultKind, 'manual'));
      setParsed(null);
      setPasteText('');
      setVoiceText('');
      setListening(false);
      setAiBusy(false);
      setAiProgress('');
      setVoiceSupported(typeof navigator.mediaDevices?.getUserMedia === 'function' && typeof window.MediaRecorder === 'function');
    }
  }, [quickAddOpen, quickAddDefaultKind]);

  const startVoice = async () => {
    if (typeof navigator.mediaDevices?.getUserMedia !== 'function' || typeof window.MediaRecorder !== 'function') {
      setVoiceSupported(false);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, { mimeType: MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : undefined });
      audioChunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        const audio = new Blob(audioChunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        void transcribeAndAnalyze(audio);
      };
      mediaRecorderRef.current = recorder;
      recorder.start();
      setListening(true);
      setAiProgress('جاري التسجيل...');
    } catch {
      setListening(false);
      toast.error('تعذر الوصول إلى المايكروفون');
    }
  };

  const stopVoice = () => {
    recognitionRef.current?.stop();
    mediaRecorderRef.current?.stop();
    setListening(false);
  };

  const analyze = async (text: string, source: 'whatsapp' | 'voice') => {
    if (!text.trim()) {
      toast.error('النص فارغ — أدخل نص الإعلان أولاً');
      return;
    }
    setAiBusy(true);
    setAiProgress(source === 'voice' ? 'يتم تحليل التفريغ عبر Gemini...' : 'يتم تحليل النص عبر Gemini...');
    try {
      const serverData = await extractPropertyWithServerAI(text);
      const p = parsedListingFromServerAI(serverData, quickAddDefaultKind);
      const nextDraft = await draftWithGoogleMapsPin(draftFromParsed(p, source, text, quickAddDefaultKind), text);
      setParsed(p);
      setDraft(nextDraft);
      setStep('review');
      toast.success('تم تحليل الإعلان عبر AI');
    } catch (error) {
      const p = parseListingText(text);
      const nextDraft = await draftWithGoogleMapsPin(draftFromParsed(p, source, text, quickAddDefaultKind), text);
      setParsed(p);
      setDraft(nextDraft);
      setStep('review');
      toast.warning(error instanceof Error ? `${error.message} — تم استخدام المحلل المحلي للمراجعة.` : 'تم استخدام المحلل المحلي للمراجعة.');
    } finally {
      setAiBusy(false);
      setAiProgress('');
    }
  };

  const transcribeAndAnalyze = async (audio: Blob) => {
    if (audio.size <= 0) {
      toast.error('التسجيل فارغ.');
      return;
    }
    setAiBusy(true);
    setAiProgress('يتم تحويل الصوت إلى نص عبر Groq Whisper...');
    try {
      const text = await transcribeWithServerAI(audio);
      setVoiceText(text);
      await analyze(text, 'voice');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'تعذر تحليل الصوت.');
      setAiBusy(false);
      setAiProgress('');
    }
  };

  const save = () => {
    if (!draft.lat || !draft.lng) {
      toast.error('📍 ثبّت موقع العقار على الخريطة أولاً (إلزامي)');
      return;
    }
    if (!draft.title.trim()) {
      toast.error('أدخل عنوان الإعلان');
      return;
    }
    const { titleTouched: _t, priceAmbiguous: _p, ...rest } = draft;
    void _t;
    void _p;
    db.addListing({ ...rest, status: rest.status as Listing['status'], title: draft.title.trim() });
    toast.success(`تم حفظ ${draft.kind === 'offer' ? 'العرض' : 'الطلب'} بنجاح ✅`);
    closeQuickAdd();
  };

  return (
    <Dialog open={quickAddOpen} onOpenChange={(v) => !v && closeQuickAdd()}>
      <DialogContent className="max-w-2xl w-[calc(100vw-1rem)] sm:w-full bg-[#0f1f3d] border-[#c9972f]/25 text-white max-h-[92vh] h-[92vh] sm:h-auto sm:max-h-[90vh] overflow-hidden flex flex-col p-0 gap-0">
        <DialogHeader className="px-4 sm:px-6 pt-4 sm:pt-5 pb-3 border-b border-border shrink-0">
          <DialogTitle className="text-lg font-extrabold flex items-center gap-2">
            <span className="w-9 h-9 rounded-xl gold-gradient flex items-center justify-center text-lg">⚡</span>
            {step === 'input' ? 'إضافة سريعة' : 'مراجعة قبل الحفظ'}
          </DialogTitle>
        </DialogHeader>

        {step === 'input' ? (
          <>
            {/* tabs */}
            <div className="grid grid-cols-3 gap-1.5 px-4 sm:px-6 py-3 shrink-0">
              {TABS.map(({ key, label, icon: Icon, hint }) => (
                <button
                  key={key}
                  onClick={() => setTab(key)}
                  className={cn(
                    'rounded-xl border p-2.5 sm:p-3 text-center transition-all',
                    tab === key
                      ? 'border-[#c9972f] bg-[#c9972f]/10 shadow-[0_0_0_1px_#c9972f]'
                      : 'border-border bg-secondary/40 hover:border-[#c9972f]/40',
                  )}
                >
                  <Icon className={cn('w-5 h-5 mx-auto mb-1', tab === key ? 'text-[#e5bc55]' : 'text-muted-foreground')} />
                  <span className={cn('block text-xs sm:text-sm font-extrabold', tab === key ? 'text-[#e5bc55]' : 'text-slate-200')}>
                    {label}
                  </span>
                  <span className="hidden sm:block text-[10px] text-muted-foreground mt-0.5">{hint}</span>
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto scrollbar-thin px-4 sm:px-6 pb-4">
              {tab === 'manual' && (
                <div className="space-y-4">
                  <DraftEditor draft={draft} onChange={setDraft} />
                </div>
              )}

              {tab === 'paste' && (
                <div className="space-y-3 pt-1">
                  <div className="rounded-xl border border-[#c9972f]/25 bg-[#c9972f]/5 p-3.5 text-sm text-slate-200 leading-relaxed">
                    <Sparkles className="w-4 h-4 inline-block ms-1 text-[#e5bc55]" />
                    الصق نص إعلان واتساب كما هو — سنستخرج تلقائياً: نوع العقار، المساحة، عرض الشارع، الحي، والسعر
                    (سوم / حد).
                  </div>
                  <textarea
                    value={pasteText}
                    onChange={(e) => setPasteText(e.target.value)}
                    rows={8}
                    placeholder={'مثال:\nأرض للبيع حي الياسمين مساحة 600 شارع 20 شمالية سوم 850000 وحدها 900000\nأو:\nفيلا للايجار حي النرجس 450 متر عمرها 3 سنوات درج صالة الصافي 2.8 مليون'}
                    className="w-full bg-secondary/50 border border-border rounded-xl px-3.5 py-3 text-sm text-white outline-none focus:border-[#c9972f]/60 resize-none leading-relaxed placeholder:text-muted-foreground/60"
                  />
                  <button
                    disabled={aiBusy}
                    onClick={() => void analyze(pasteText, 'whatsapp')}
                    className="w-full gold-gradient text-[#0f1f3d] font-extrabold rounded-xl py-3 flex items-center justify-center gap-2 hover:brightness-110 active:scale-[0.99] transition-all"
                  >
                    <Sparkles className="w-5 h-5" />
                    تحليل النص والانتقال للمراجعة
                  </button>
                </div>
              )}

              {tab === 'voice' && (
                <div className="space-y-3 pt-1">
                  {!voiceSupported ? (
                    <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-200 leading-relaxed">
                      ⚠️ متصفحك لا يدعم التسجيل الصوتي المباشر. يمكنك كتابة النص يدوياً أدناه وسيمر بنفس محلل Gemini.
                    </div>
                  ) : (
                    <div className="rounded-xl border border-border bg-secondary/40 p-4 text-center">
                      <button
                        disabled={aiBusy && !listening}
                        onClick={listening ? stopVoice : () => void startVoice()}
                        className={cn(
                          'w-20 h-20 rounded-full mx-auto flex items-center justify-center transition-all shadow-xl',
                          listening
                            ? 'bg-red-500 animate-pulse shadow-red-500/40'
                            : 'gold-gradient shadow-[#c9972f]/30 hover:brightness-110',
                        )}
                      >
                        {listening ? <MicOff className="w-9 h-9 text-white" /> : <Mic className="w-9 h-9 text-[#0f1f3d]" />}
                      </button>
                      <p className="mt-3 text-sm font-bold text-slate-200">
                        {listening ? '🔴 جارٍ الاستماع… تحدث بالعربية' : 'اضغط للتحدث (ar-SA)'}
                      </p>
                      <p className="text-[11px] text-muted-foreground mt-1">
                        مثال: «أرض للبيع في حي الياسمين مساحة 600 شارع 20 وصلت سوم 850 ألف»
                      </p>
                    </div>
                  )}
                  <textarea
                    value={voiceText}
                    onChange={(e) => setVoiceText(e.target.value)}
                    rows={5}
                    placeholder="سيظهر النص المفرّغ هنا — يمكنك تعديله قبل التحليل…"
                    className="w-full bg-secondary/50 border border-border rounded-xl px-3.5 py-3 text-sm text-white outline-none focus:border-[#c9972f]/60 resize-none leading-relaxed"
                  />
                  {aiProgress && <p className="text-xs font-bold text-[#e5bc55] text-center">{aiProgress}</p>}
                  <button
                    disabled={aiBusy}
                    onClick={() => void analyze(voiceText, 'voice')}
                    className="w-full gold-gradient text-[#0f1f3d] font-extrabold rounded-xl py-3 flex items-center justify-center gap-2 hover:brightness-110 active:scale-[0.99] transition-all"
                  >
                    <Sparkles className="w-5 h-5" />
                    تحليل التفريغ الصوتي والانتقال للمراجعة
                  </button>
                </div>
              )}
            </div>

            {tab === 'manual' && (
              <div className="shrink-0 border-t border-border px-4 sm:px-6 py-3 bg-[#0c1a36]">
                <button
                  onClick={() => setStep('review')}
                  className="w-full gold-gradient text-[#0f1f3d] font-extrabold rounded-xl py-3 flex items-center justify-center gap-2 hover:brightness-110 active:scale-[0.99] transition-all"
                >
                  التالي: المراجعة قبل الحفظ
                  <ArrowRight className="w-5 h-5 rotate-180" />
                </button>
              </div>
            )}
          </>
        ) : (
          <>
            {/* ===== Pre-Save Review Panel ===== */}
            <div className="flex-1 overflow-y-auto scrollbar-thin px-4 sm:px-6 py-4">
              {parsed && (
                <div className="mb-4 rounded-xl border border-emerald-500/25 bg-emerald-500/5 p-3.5">
                  <p className="text-xs font-extrabold text-emerald-300 mb-2 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4" />
                    ما تم استخراجه تلقائياً — كل حقل قابل للتعديل:
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    <span className="text-[11px] font-bold px-2 py-1 rounded-lg bg-[#c9972f]/15 text-[#e5bc55] border border-[#c9972f]/30">
                      {PROPERTY_TYPE_LABELS[parsed.propertyType]}
                    </span>
                    {parsed.confidence.map((c) => (
                      <span key={c} className="text-[11px] font-semibold px-2 py-1 rounded-lg bg-secondary/80 text-slate-200 border border-border">
                        {c}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              <DraftEditor draft={draft} onChange={setDraft} />
            </div>
            <div className="shrink-0 border-t border-border px-4 sm:px-6 py-3 bg-[#0c1a36] grid grid-cols-[auto_1fr] gap-2.5">
              <button
                onClick={() => setStep('input')}
                className="rounded-xl border border-border bg-secondary/50 text-slate-200 font-bold px-5 py-3 hover:bg-secondary transition-colors"
              >
                رجوع
              </button>
              <button
                onClick={save}
                className="gold-gradient text-[#0f1f3d] font-extrabold rounded-xl py-3 flex items-center justify-center gap-2 hover:brightness-110 active:scale-[0.99] transition-all"
              >
                <Save className="w-5 h-5" />
                حفظ {draft.kind === 'offer' ? 'العرض' : 'الطلب'}
              </button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
