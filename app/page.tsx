'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { Building2, KeyRound, Loader2, LogIn, Mail, ShieldCheck, UserPlus } from 'lucide-react';
import dynamic from 'next/dynamic';
import { initializeDB, type BackendUser } from '@/ui/lib/db';

const ReferenceApp = dynamic(() => import('@/ui/App'), {
  ssr: false,
  loading: () => <Loader2 className="size-8 animate-spin text-[#e5bc55]" aria-label="جاري تحميل الواجهة" />,
});

type AuthMode = 'login' | 'register' | 'confirm' | 'forgot' | 'reset';

type ApiBody = {
  user?: BackendUser | null;
  state?: unknown;
  email?: string;
  message?: string;
  error?: string;
};

async function readBody(response: Response): Promise<ApiBody> {
  return (await response.json().catch(() => ({}))) as ApiBody;
}

export default function Home() {
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<BackendUser | null>(null);
  const [mode, setMode] = useState<AuthMode>('login');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [email, setEmail] = useState('');

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const sessionResponse = await fetch('/api/auth/session', { cache: 'no-store' });
        const session = await readBody(sessionResponse);
        if (!session.user || cancelled) return;
        const workspaceResponse = await fetch('/api/workspace', { cache: 'no-store' });
        const workspace = await readBody(workspaceResponse);
        if (!workspaceResponse.ok) throw new Error(workspace.error || 'تعذر تحميل بيانات الحساب.');
        initializeDB(workspace.state, session.user);
        setUser(session.user);
      } catch (error) {
        if (!cancelled) setMessage(error instanceof Error ? error.message : 'تعذر الاتصال بالخادم.');
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function enterApp(nextUser: BackendUser) {
    const response = await fetch('/api/workspace', { cache: 'no-store' });
    const body = await readBody(response);
    if (!response.ok) throw new Error(body.error || 'تعذر تحميل بيانات الحساب.');
    initializeDB(body.state, nextUser);
    setUser(nextUser);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setMessage('');
    try {
      let endpoint = '/api/auth/login';
      let payload: Record<string, string> = {};
      if (mode === 'login') {
        payload = { identifier: String(form.get('identifier') || ''), password: String(form.get('password') || '') };
      } else if (mode === 'register') {
        endpoint = '/api/auth/register';
        payload = {
          email: String(form.get('email') || ''),
          password: String(form.get('password') || ''),
          name: String(form.get('name') || ''),
          phone: String(form.get('phone') || ''),
          falLicense: String(form.get('falLicense') || ''),
        };
      } else if (mode === 'confirm') {
        endpoint = '/api/auth/confirm-email';
        payload = { email: String(form.get('email') || email), code: String(form.get('code') || '') };
      } else if (mode === 'forgot') {
        endpoint = '/api/auth/forgot-password';
        payload = { email: String(form.get('email') || '') };
      } else {
        endpoint = '/api/auth/reset-password';
        payload = {
          email: String(form.get('email') || email),
          code: String(form.get('code') || ''),
          password: String(form.get('password') || ''),
        };
      }
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const body = await readBody(response);
      if (!response.ok) throw new Error(body.error || 'تعذر تنفيذ الطلب.');
      setMessage(body.message || 'تم بنجاح.');
      if (body.user) {
        await enterApp(body.user);
      } else if (mode === 'register') {
        setEmail(body.email || payload.email);
        setMode('confirm');
      } else if (mode === 'forgot') {
        setEmail(payload.email);
        setMode('reset');
      } else if (mode === 'reset') {
        const sessionResponse = await fetch('/api/auth/session', { cache: 'no-store' });
        const session = await readBody(sessionResponse);
        if (session.user) await enterApp(session.user);
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'تعذر تنفيذ الطلب.');
    } finally {
      setBusy(false);
    }
  }

  if (!ready) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#071224] text-white">
        <Loader2 className="size-8 animate-spin text-[#e5bc55]" aria-label="جاري التحميل" />
      </main>
    );
  }

  if (user) return <ReferenceApp />;

  const titles: Record<AuthMode, string> = {
    login: 'تسجيل الدخول',
    register: 'إنشاء حساب وسيط',
    confirm: 'تفعيل البريد',
    forgot: 'استعادة كلمة المرور',
    reset: 'كلمة مرور جديدة',
  };

  return (
    <main className="min-h-screen bg-[#071224] px-4 py-8 text-white">
      <div className="mx-auto grid min-h-[calc(100vh-4rem)] max-w-5xl items-center gap-8 lg:grid-cols-2">
        <section className="space-y-5">
          <div className="flex items-center gap-3">
            <span className="gold-gradient grid size-14 place-items-center rounded-xl">
              <Building2 className="size-8 text-[#0f1f3d]" />
            </span>
            <div>
              <h1 className="text-3xl font-extrabold">مفكرة الوسيط</h1>
              <p className="font-bold text-[#e5bc55]">العقاري</p>
            </div>
          </div>
          <h2 className="max-w-xl text-4xl font-black leading-tight">بياناتك العقارية، مرتبة ومحفوظة في حسابك.</h2>
          <p className="max-w-xl leading-8 text-slate-300">أدر عروضك وطلبات عملائك ومتابعاتك من واجهة واحدة عربية ومهيأة للعمل اليومي.</p>
          <div className="flex gap-3 text-sm font-bold text-slate-300">
            <span className="flex items-center gap-2"><ShieldCheck className="size-5 text-emerald-400" /> بيانات خاصة</span>
            <span className="flex items-center gap-2"><KeyRound className="size-5 text-[#e5bc55]" /> دخول آمن</span>
          </div>
        </section>

        <section className="rounded-2xl border border-[#c9972f]/25 bg-[#0f1f3d] p-5 card-glow sm:p-7">
          <h2 className="text-2xl font-extrabold">{titles[mode]}</h2>
          <form className="mt-5 grid gap-3" onSubmit={submit}>
            {mode === 'register' && <AuthInput name="name" label="الاسم" autoComplete="name" required />}
            {(mode === 'register' || mode === 'confirm' || mode === 'forgot' || mode === 'reset') && (
              <AuthInput name="email" label="البريد الإلكتروني" type="email" defaultValue={email} autoComplete="email" required />
            )}
            {mode === 'register' && <AuthInput name="phone" label="رقم الجوال" type="tel" autoComplete="tel" required />}
            {mode === 'register' && <AuthInput name="falLicense" label="رخصة فال (اختياري)" />}
            {mode === 'login' && <AuthInput name="identifier" label="البريد أو الجوال" autoComplete="username" required />}
            {(mode === 'login' || mode === 'register' || mode === 'reset') && (
              <AuthInput name="password" label={mode === 'reset' ? 'كلمة المرور الجديدة' : 'كلمة المرور'} type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} minLength={8} required />
            )}
            {(mode === 'confirm' || mode === 'reset') && <AuthInput name="code" label="رمز OTP المكون من 6 أرقام" inputMode="numeric" pattern="[0-9]{6}" required />}
            {message && <p className="rounded-xl border border-[#c9972f]/25 bg-[#c9972f]/10 px-3 py-2 text-sm leading-6 text-slate-200">{message}</p>}
            <button disabled={busy} className="gold-gradient mt-1 flex min-h-12 items-center justify-center gap-2 rounded-xl font-extrabold text-[#0f1f3d]">
              {busy ? <Loader2 className="size-5 animate-spin" /> : mode === 'register' ? <UserPlus className="size-5" /> : mode === 'forgot' ? <Mail className="size-5" /> : mode === 'confirm' ? <ShieldCheck className="size-5" /> : <LogIn className="size-5" />}
              {titles[mode]}
            </button>
          </form>
          <div className="mt-4 flex flex-wrap gap-2 text-sm font-bold">
            {mode !== 'login' && <button onClick={() => setMode('login')} className="rounded-lg px-3 py-2 text-[#e5bc55]">لدي حساب</button>}
            {mode !== 'register' && <button onClick={() => setMode('register')} className="rounded-lg px-3 py-2 text-[#e5bc55]">حساب جديد</button>}
            {mode === 'login' && <button onClick={() => setMode('forgot')} className="rounded-lg px-3 py-2 text-slate-300">نسيت كلمة المرور</button>}
          </div>
        </section>
      </div>
    </main>
  );
}

function AuthInput({ label, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label className="grid gap-1.5 text-sm font-bold text-slate-300">
      <span>{label}</span>
      <input {...props} className="h-12 rounded-xl border border-slate-600/50 bg-[#0a1730] px-3 text-white outline-none focus:border-[#c9972f]" />
    </label>
  );
}
