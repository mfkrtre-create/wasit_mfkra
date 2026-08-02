import { notFound } from "next/navigation";
import { hashToken } from "@/lib/app-auth";
import { getDb } from "@/lib/db";
import { type PublicShareSnapshot } from "@/lib/share-snapshots";

type SharePageProps = {
  params: Promise<{ token: string }>;
};

function formatMoney(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return null;
  }

  return new Intl.NumberFormat("ar-SA", {
    style: "currency",
    currency: "SAR",
    maximumFractionDigits: 0,
  }).format(value);
}

function Detail({ label, value }: { label: string; value: string | number | null | undefined }) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <p className="text-xs font-bold text-slate-500">{label}</p>
      <p className="mt-2 text-lg font-black text-slate-950">{value}</p>
    </div>
  );
}

export default async function SharePage({ params }: SharePageProps) {
  const { token } = await params;
  const result = await getDb().query(
    `
      select title, snapshot, expires_at, created_at
      from share_snapshots
      where token_hash = $1
        and revoked_at is null
        and (expires_at is null or expires_at > now())
      limit 1
    `,
    [hashToken(token)],
  );

  const row = result.rows[0];
  if (!row) {
    notFound();
  }

  const snapshot = row.snapshot as PublicShareSnapshot;
  const amount = formatMoney(snapshot.price ?? snapshot.budget);
  const hasLocation = Number.isFinite(snapshot.lat) && Number.isFinite(snapshot.lng);

  return (
    <main className="min-h-screen bg-slate-100 p-4 text-slate-950 lg:p-8">
      <section className="mx-auto grid max-w-4xl gap-5">
        <header className="rounded-2xl border border-teal-100 bg-white p-6 shadow-sm">
          <p className="text-sm font-bold text-teal-700">مشاركة عقارية من مفكرة الوسيط</p>
          <h1 className="mt-3 text-3xl font-black leading-tight">{snapshot.title || row.title}</h1>
          <p className="mt-3 text-slate-600">
            {snapshot.kind} | {snapshot.status}
          </p>
        </header>

        <section className="grid gap-3 md:grid-cols-2">
          <Detail label="المدينة" value={snapshot.city} />
          <Detail label="الحي" value={snapshot.district} />
          <Detail label="نوع العقار" value={snapshot.propertyType} />
          <Detail label="نوع العملية" value={snapshot.transaction} />
          <Detail label="القيمة" value={amount} />
          <Detail label="المساحة" value={snapshot.area ? `${snapshot.area} م²` : null} />
          <Detail label="التواصل" value={snapshot.contact} />
        </section>

        {snapshot.notes ? (
          <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-bold text-slate-500">ملاحظات</p>
            <p className="mt-2 leading-8 text-slate-700">{snapshot.notes}</p>
          </section>
        ) : null}

        {hasLocation ? (
          <a
            href={`https://www.openstreetmap.org/?mlat=${snapshot.lat}&mlon=${snapshot.lng}#map=16/${snapshot.lat}/${snapshot.lng}`}
            target="_blank"
            rel="noreferrer"
            className="rounded-lg border border-teal-200 bg-teal-50 p-4 text-center font-black text-teal-900 shadow-sm"
          >
            فتح الموقع على الخريطة
          </a>
        ) : null}

        <footer className="text-center text-xs leading-6 text-slate-500">
          هذا الرابط يعرض فقط البيانات التي سمح الوسيط بمشاركتها. قد تنتهي صلاحية الرابط أو يتم إلغاؤه لاحقاً.
        </footer>
      </section>
    </main>
  );
}
