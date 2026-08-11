import { useEffect, useState } from 'react';
import { Download, FileText, RefreshCw } from 'lucide-react';

type DocumentItem = {
  name: string;
  size: number;
  type: 'txt' | 'docx';
  url: string;
  content: string | null;
};

function formatSize(size: number) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

export function DocumentsPage() {
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/documents', { cache: 'no-store' });
      const body = (await response.json().catch(() => null)) as { documents?: DocumentItem[]; error?: string } | null;
      if (!response.ok || !body?.documents) {
        throw new Error(body?.error || 'تعذر تحميل المستندات.');
      }
      setDocuments(body.documents);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'تعذر تحميل المستندات.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, []);

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto">
      <header className="flex items-center justify-between gap-3 mb-5">
        <div>
          <p className="text-sm font-extrabold text-[#e5bc55]">مستندات المشروع</p>
          <h2 className="text-2xl md:text-3xl font-extrabold text-white mt-1">documents</h2>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="rounded-xl border border-border bg-card px-3 py-2 text-sm font-extrabold text-slate-200 hover:border-[#c9972f]/40"
        >
          <RefreshCw className="inline-block w-4 h-4 ms-1" />
          تحديث
        </button>
      </header>

      {error && <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm font-bold text-red-200">{error}</div>}
      {loading && <div className="rounded-2xl border border-border bg-card p-8 text-center font-bold text-muted-foreground">جاري تحميل المستندات...</div>}

      {!loading && (
        <div className="grid gap-4">
          {documents.map((doc) => (
            <section key={doc.name} className="rounded-2xl border border-border bg-card card-glow overflow-hidden">
              <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl gold-gradient flex items-center justify-center shrink-0">
                    <FileText className="w-5 h-5 text-[#0f1f3d]" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-extrabold text-white truncate">{doc.name}</h3>
                    <p className="text-xs text-muted-foreground nums-latin">{doc.type.toUpperCase()} • {formatSize(doc.size)}</p>
                  </div>
                </div>
                <a
                  href={doc.url}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-xl border border-[#c9972f]/35 bg-[#c9972f]/15 px-3 py-2 text-xs font-extrabold text-[#e5bc55] hover:bg-[#c9972f]/25"
                >
                  <Download className="inline-block w-4 h-4 ms-1" />
                  فتح
                </a>
              </div>
              {doc.content && (
                <pre className="max-h-[34rem] overflow-y-auto whitespace-pre-wrap p-4 text-sm leading-8 text-slate-200 font-[inherit] scrollbar-thin">
                  {doc.content}
                </pre>
              )}
            </section>
          ))}
          {documents.length === 0 && (
            <div className="rounded-2xl border border-dashed border-border bg-card p-8 text-center font-bold text-muted-foreground">
              لا توجد مستندات داخل مجلد documents.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
