/** Formatting helpers — digits stay Latin for clarity in prices */

export const fmtMoney = (n?: number): string =>
  n === undefined || n === null ? '—' : `${n.toLocaleString('en-US')} ر.س`;

export const fmtCompact = (n?: number): string => {
  if (n === undefined || n === null) return '—';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)} مليون`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(n % 1_000 === 0 ? 0 : 1)} ألف`;
  return n.toLocaleString('en-US');
};

export const fmtDate = (iso?: string): string => {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('ar-SA-u-nu-latn', { year: 'numeric', month: 'long', day: 'numeric' });
};

export const fmtDateTime = (iso?: string): string => {
  if (!iso) return '—';
  const d = new Date(iso);
  return `${d.toLocaleDateString('ar-SA-u-nu-latn', { month: 'short', day: 'numeric' })} — ${d.toLocaleTimeString('ar-SA-u-nu-latn', { hour: '2-digit', minute: '2-digit' })}`;
};

export const timeAgo = (iso: string): string => {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'الآن';
  if (mins < 60) return `قبل ${mins} دقيقة`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `قبل ${hours} ساعة`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `قبل ${days} يوم`;
  const months = Math.floor(days / 30);
  return `قبل ${months} شهر`;
};

export const monthKey = (iso: string): string => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

export const monthLabel = (key: string): string => {
  const [y, m] = key.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('ar-SA-u-nu-latn', { year: 'numeric', month: 'long' });
};

/** Normalize a phone to wa.me format (digits only, country code) */
export const waPhone = (phone?: string): string => {
  if (!phone) return '';
  let digits = phone.replace(/\D/g, '');
  if (digits.startsWith('05')) digits = '966' + digits.slice(1);
  if (digits.startsWith('5') && digits.length === 9) digits = '966' + digits;
  return digits;
};

export const waLink = (phone: string | undefined, message: string): string => {
  const p = waPhone(phone);
  const base = p ? `https://wa.me/${p}` : 'https://wa.me/';
  return `${base}?text=${encodeURIComponent(message)}`;
};
