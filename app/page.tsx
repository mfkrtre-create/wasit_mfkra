"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Bell,
  Building2,
  Calculator,
  CalendarClock,
  CheckCircle2,
  CircleDollarSign,
  ClipboardCopy,
  Filter,
  LayoutDashboard,
  MapPinned,
  MessageCircle,
  Mic2,
  Plus,
  RotateCcw,
  Search,
  Send,
  Share2,
  ShieldCheck,
  Sparkles,
  Trash2,
  UserPlus,
  Users,
  WandSparkles,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { LocationPicker } from "@/components/LocationPicker";
import { RealEstateMap } from "@/components/RealEstateMap";
import { filterMapRecords, type MapRecord } from "@/lib/map-records";
import { type PropertyData } from "@/lib/property-schema";
import { getSupabaseBrowserClient, hasSupabaseBrowserConfig } from "@/lib/supabase-browser";
import { type User } from "@supabase/supabase-js";

type ViewId =
  | "dashboard"
  | "offers"
  | "requests"
  | "ai"
  | "map"
  | "clients"
  | "admin";

type ProfileSection = "settings" | "auth" | "reminders" | "notifications" | "sharing" | "trash";
type RecordKind = "offer" | "request";
type OfferStatus = "for_sale" | "for_rent" | "sold_or_rented" | "archived";
type RequestStatus = "purchase" | "rental" | "fulfilled" | "archived";
type RecordStatus = OfferStatus | RequestStatus;
type ReminderStatus = "scheduled" | "due" | "completed";
type NotificationLevel = "info" | "warning" | "success";

type BrokerProfile = {
  id: string;
  name: string;
  role: "admin" | "broker";
  timezone: string;
  inviteOnly: boolean;
  smtpReady: boolean;
};

type PropertyRecord = {
  id: string;
  kind: RecordKind;
  title: string;
  propertyType: string;
  transaction: string;
  status: RecordStatus;
  city: string;
  district: string;
  area: number | null;
  price: number | null;
  budget: number | null;
  streetWidth: number | null;
  facade: string;
  bedrooms: number | null;
  bathrooms: number | null;
  clientId: string;
  contact: string;
  license: string;
  notes: string;
  tags: string[];
  source: "manual" | "ai-text" | "ai-voice";
  lat: number | null;
  lng: number | null;
  createdAt: string;
  updatedAt: string;
  sharedAt: string | null;
  deletedAt: string | null;
};

type ClientRecord = {
  id: string;
  name: string;
  phone: string;
  type: "owner" | "buyer" | "tenant" | "broker";
  priority: "high" | "medium" | "low";
  notes: string;
  lastContactAt: string;
};

type Reminder = {
  id: string;
  recordId: string;
  title: string;
  dueAt: string;
  status: ReminderStatus;
};

type NotificationItem = {
  id: string;
  title: string;
  body: string;
  level: NotificationLevel;
  createdAt: string;
  read: boolean;
};

type WorkspaceState = {
  profile: BrokerProfile;
  records: PropertyRecord[];
  clients: ClientRecord[];
  reminders: Reminder[];
  notifications: NotificationItem[];
};

type FilterState = {
  query: string;
  status: "all" | RecordStatus;
  city: string;
};

const storageKey = "wasit-mfkra-local-mvp-state-v1";
const riyadhTimezone = "Asia/Riyadh";
const hasCloudPersistence = hasSupabaseBrowserConfig();

const navItems: Array<{ id: ViewId; label: string; icon: LucideIcon }> = [
  { id: "dashboard", label: "لوحة التحكم", icon: LayoutDashboard },
  { id: "offers", label: "العروض", icon: Building2 },
  { id: "requests", label: "الطلبات", icon: Search },
  { id: "map", label: "الخريطة", icon: MapPinned },
  { id: "clients", label: "العملاء", icon: Users },
  { id: "admin", label: "الملف الشخصي", icon: ShieldCheck },
];

const viewTitles: Record<ViewId, string> = {
  dashboard: "لوحة التحكم",
  offers: "العروض",
  requests: "الطلبات",
  ai: "إدخال AI",
  map: "الخريطة",
  clients: "العملاء",
  admin: "الملف الشخصي",
};

const profileSections: Array<{ id: ProfileSection; label: string; icon: LucideIcon }> = [
  { id: "settings", label: "الحساب", icon: ShieldCheck },
  { id: "auth", label: "الدخول والتسجيل", icon: UserPlus },
  { id: "reminders", label: "التذكيرات", icon: CalendarClock },
  { id: "notifications", label: "الإشعارات", icon: Bell },
  { id: "sharing", label: "المشاركة", icon: Share2 },
  { id: "trash", label: "سلة المهملات", icon: Trash2 },
];

const recordKindLabels: Record<RecordKind, string> = {
  offer: "عرض",
  request: "طلب",
};

const statusLabels: Record<RecordStatus, string> = {
  for_sale: "للبيع",
  for_rent: "للإيجار",
  sold_or_rented: "مباع/مؤجر",
  purchase: "شراء",
  rental: "استئجار",
  fulfilled: "تمت تلبية الطلب",
  archived: "مؤرشف",
};

const statusOptionsByKind: Record<RecordKind, Array<{ value: RecordStatus; label: string }>> = {
  offer: [
    { value: "for_sale", label: statusLabels.for_sale },
    { value: "for_rent", label: statusLabels.for_rent },
    { value: "sold_or_rented", label: statusLabels.sold_or_rented },
    { value: "archived", label: statusLabels.archived },
  ],
  request: [
    { value: "purchase", label: statusLabels.purchase },
    { value: "rental", label: statusLabels.rental },
    { value: "fulfilled", label: statusLabels.fulfilled },
    { value: "archived", label: statusLabels.archived },
  ],
};

const availableStatuses = new Set<RecordStatus>([...statusOptionsByKind.offer, ...statusOptionsByKind.request].map((option) => option.value));

const clientTypeLabels: Record<ClientRecord["type"], string> = {
  owner: "مالك",
  buyer: "مشتري",
  tenant: "مستأجر",
  broker: "وسيط",
};

const propertyTypeLabels: Record<string, string> = {
  residential_land: "أرض سكنية",
  commercial_land: "أرض تجارية",
  villa: "فيلا",
  apartment: "شقة",
  building: "عمارة",
  farm: "مزرعة",
  office: "مكتب",
  warehouse: "مستودع",
  other: "أخرى",
  unknown: "غير محدد",
};

const transactionLabels: Record<string, string> = {
  sale: "بيع",
  rent: "إيجار",
  buy: "شراء",
  rent_request: "طلب إيجار",
  unknown: "غير محدد",
};

const seedState: WorkspaceState = {
  profile: {
    id: "profile-1",
    name: "وسيط مفكرة",
    role: "admin",
    timezone: riyadhTimezone,
    inviteOnly: true,
    smtpReady: false,
  },
  clients: [
    {
      id: "client-1",
      name: "أبو خالد",
      phone: "966501234567",
      type: "owner",
      priority: "high",
      notes: "يفضل التواصل واتساب قبل الاتصال.",
      lastContactAt: "2026-07-28T08:30:00.000Z",
    },
    {
      id: "client-2",
      name: "شركة نجد للاستثمار",
      phone: "966551112233",
      type: "buyer",
      priority: "medium",
      notes: "تبحث عن فرص شمال الرياض.",
      lastContactAt: "2026-07-27T11:00:00.000Z",
    },
    {
      id: "client-3",
      name: "سارة العتيبي",
      phone: "966566667777",
      type: "tenant",
      priority: "medium",
      notes: "طلب إيجار شقة بثلاث غرف.",
      lastContactAt: "2026-07-26T15:20:00.000Z",
    },
  ],
  records: [
    {
      id: "rec-1",
      kind: "offer",
      title: "أرض سكنية في العارض",
      propertyType: "أرض سكنية",
      transaction: "بيع",
      status: "for_sale",
      city: "الرياض",
      district: "العارض",
      area: 450,
      price: 1350000,
      budget: null,
      streetWidth: 20,
      facade: "شمالية",
      bedrooms: null,
      bathrooms: null,
      clientId: "client-1",
      contact: "966501234567",
      license: "123456",
      notes: "صافي، مناسب للسكن الخاص.",
      tags: ["صافي", "شمال الرياض"],
      source: "ai-text",
      lat: 24.857,
      lng: 46.621,
      createdAt: "2026-07-27T10:00:00.000Z",
      updatedAt: "2026-07-28T09:00:00.000Z",
      sharedAt: null,
      deletedAt: null,
    },
    {
      id: "rec-2",
      kind: "request",
      title: "طلب فيلا شمال الرياض",
      propertyType: "فيلا",
      transaction: "شراء",
      status: "purchase",
      city: "الرياض",
      district: "الياسمين أو النرجس",
      area: null,
      price: null,
      budget: 2200000,
      streetWidth: null,
      facade: "",
      bedrooms: 4,
      bathrooms: null,
      clientId: "client-2",
      contact: "966551112233",
      license: "",
      notes: "الأولوية للمواقع القريبة من الخدمات.",
      tags: ["طلب مشتري", "ميزانية محددة"],
      source: "ai-voice",
      lat: 24.835,
      lng: 46.668,
      createdAt: "2026-07-28T08:00:00.000Z",
      updatedAt: "2026-07-28T08:15:00.000Z",
      sharedAt: "2026-07-28T12:10:00.000Z",
      deletedAt: null,
    },
    {
      id: "rec-3",
      kind: "offer",
      title: "شقة للإيجار في الملقا",
      propertyType: "شقة",
      transaction: "إيجار",
      status: "for_rent",
      city: "الرياض",
      district: "الملقا",
      area: 135,
      price: 85000,
      budget: null,
      streetWidth: 18,
      facade: "غربية",
      bedrooms: 3,
      bathrooms: 3,
      clientId: "client-3",
      contact: "966566667777",
      license: "987654",
      notes: "سنوي، موقف خاص، قريبة من طريق أنس.",
      tags: ["إيجار", "شقة"],
      source: "manual",
      lat: 24.804,
      lng: 46.598,
      createdAt: "2026-07-25T12:00:00.000Z",
      updatedAt: "2026-07-28T07:30:00.000Z",
      sharedAt: null,
      deletedAt: null,
    },
  ],
  reminders: [
    {
      id: "rem-1",
      recordId: "rec-1",
      title: "متابعة المالك لتحديث السعر",
      dueAt: "2026-07-30T07:00:00.000Z",
      status: "scheduled",
    },
    {
      id: "rem-2",
      recordId: "rec-2",
      title: "إرسال خيارات فيلا لشركة نجد",
      dueAt: "2026-07-29T09:00:00.000Z",
      status: "due",
    },
  ],
  notifications: [
    {
      id: "note-1",
      title: "تذكير مستحق",
      body: "إرسال خيارات فيلا لشركة نجد مستحق اليوم.",
      level: "warning",
      createdAt: "2026-07-29T06:00:00.000Z",
      read: false,
    },
    {
      id: "note-2",
      title: "تم حفظ مشاركة",
      body: "تم تجهيز نص واتساب لطلب فيلا شمال الرياض.",
      level: "success",
      createdAt: "2026-07-28T12:10:00.000Z",
      read: true,
    },
  ],
};

function nowIso() {
  return new Date().toISOString();
}

function makeId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

function formatMoney(value: number | null) {
  if (value === null || !Number.isFinite(value)) {
    return "غير محدد";
  }

  return new Intl.NumberFormat("ar-SA", {
    style: "currency",
    currency: "SAR",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDateTime(value: string, timezone: string) {
  return new Intl.DateTimeFormat("ar-SA", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: timezone,
  }).format(new Date(value));
}

function normalizePhone(phone: string) {
  return phone.replace(/[^\d]/g, "").replace(/^0/, "966");
}

function recordAmount(record: PropertyRecord) {
  return record.kind === "offer" ? record.price : record.budget;
}

function defaultStatusForRecord(kind: RecordKind, transaction = ""): RecordStatus {
  const normalizedTransaction = transaction.trim().toLowerCase();
  const isRent =
    normalizedTransaction.includes("rent") ||
    normalizedTransaction.includes("إيجار") ||
    normalizedTransaction.includes("ايجار") ||
    normalizedTransaction.includes("استئجار");

  if (kind === "offer") {
    return isRent ? "for_rent" : "for_sale";
  }

  return isRent ? "rental" : "purchase";
}

function normalizeRecordStatus(kind: RecordKind, status: string, transaction = ""): RecordStatus {
  if (availableStatuses.has(status as RecordStatus)) {
    return status as RecordStatus;
  }

  if (status === "active") {
    return defaultStatusForRecord(kind, transaction);
  }

  if (status === "reserved") {
    return kind === "offer" ? "sold_or_rented" : "fulfilled";
  }

  if (status === "closed") {
    return "archived";
  }

  return defaultStatusForRecord(kind, transaction);
}

function normalizeWorkspaceState(state: WorkspaceState): WorkspaceState {
  return {
    ...state,
    records: state.records.map((record) => ({
      ...record,
      status: normalizeRecordStatus(record.kind, String(record.status), record.transaction),
    })),
  };
}

function recordShareText(record: PropertyRecord) {
  const amount = recordAmount(record);
  return [
    `${recordKindLabels[record.kind]}: ${record.title}`,
    `الحالة: ${statusLabels[record.status]}`,
    `الموقع: ${record.city} - ${record.district}`,
    `النوع: ${record.propertyType} | العملية: ${record.transaction}`,
    amount ? `القيمة: ${formatMoney(amount)}` : null,
    record.area ? `المساحة: ${record.area} م²` : null,
    record.contact ? `التواصل: ${record.contact}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

function mapAiToRecord(data: PropertyData, source: "ai-text" | "ai-voice", clients: ClientRecord[]): PropertyRecord {
  const kind = data.recordType;
  const city = data.city ?? "الرياض";
  const district = data.districts[0] ?? "غير محدد";
  const clientId = clients[0]?.id ?? "";
  const transaction = data.transactionType ? transactionLabels[data.transactionType] : "غير محدد";
  const propertyType = data.propertyType ? propertyTypeLabels[data.propertyType] : "غير محدد";

  return {
    id: makeId("rec"),
    kind,
    title: `${recordKindLabels[kind]} ${propertyType} في ${district}`,
    propertyType,
    transaction,
    status: defaultStatusForRecord(kind, transaction),
    city,
    district,
    area: data.area,
    price: data.price,
    budget: data.maximumBudget,
    streetWidth: data.streetWidth,
    facade: data.facade ?? "",
    bedrooms: data.bedrooms ?? data.minimumBedrooms,
    bathrooms: data.bathrooms,
    clientId,
    contact: data.contactNumber ?? "",
    license: data.licenseNumber ?? "",
    notes: data.description ?? "",
    tags: data.missingFields.length > 0 ? ["يحتاج مراجعة"] : ["مدخل AI"],
    source,
    lat: null,
    lng: null,
    createdAt: nowIso(),
    updatedAt: nowIso(),
    sharedAt: null,
    deletedAt: null,
  };
}

function metricClass(tone: "teal" | "blue" | "amber" | "slate") {
  const tones = {
    teal: "border-teal-200 bg-teal-50 text-teal-950",
    blue: "border-blue-200 bg-blue-50 text-blue-950",
    amber: "border-amber-200 bg-amber-50 text-amber-950",
    slate: "border-slate-200 bg-white text-slate-950",
  };

  return `rounded-lg border p-4 shadow-sm ${tones[tone]}`;
}

function fieldClass() {
  return "h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-950 outline-none transition focus:border-teal-700 focus:ring-2 focus:ring-teal-600/20";
}

function hasUsableCoordinates(latitude: number, longitude: number) {
  return Number.isFinite(latitude) && latitude >= -90 && latitude <= 90 && Number.isFinite(longitude) && longitude >= -180 && longitude <= 180;
}

export default function Home() {
  const [workspace, setWorkspace] = useState<WorkspaceState>(seedState);
  const [storageReady, setStorageReady] = useState(false);
  const [view, setView] = useState<ViewId>("dashboard");
  const [filters, setFilters] = useState<FilterState>({ query: "", status: "all", city: "all" });
  const [aiText, setAiText] = useState("");
  const [aiResult, setAiResult] = useState<PropertyData | null>(null);
  const [aiSource, setAiSource] = useState<"ai-text" | "ai-voice">("ai-text");
  const [aiBusy, setAiBusy] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const [expandedCalculatorRecordId, setExpandedCalculatorRecordId] = useState<string | null>(null);
  const [profileSection, setProfileSection] = useState<ProfileSection>("settings");
  const [selectedShareId, setSelectedShareId] = useState(seedState.records[0]?.id ?? "");
  const [hoveredMapId, setHoveredMapId] = useState<string | null>(null);
  const [isMobileMapOpen, setIsMobileMapOpen] = useState(false);
  const [recordFormVersion, setRecordFormVersion] = useState(0);
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authName, setAuthName] = useState("");
  const [authMode, setAuthMode] = useState<"login" | "register" | "magic">("login");
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(!hasCloudPersistence);
  const [authMessage, setAuthMessage] = useState<string | null>(null);
  const [cloudStatus, setCloudStatus] = useState<"local" | "checking" | "synced" | "blocked" | "error">(
    hasCloudPersistence ? "checking" : "local",
  );
  const cloudLoadedRef = useRef(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const saved = window.localStorage.getItem(storageKey);
      if (saved) {
        try {
          const parsed = normalizeWorkspaceState(JSON.parse(saved) as WorkspaceState);
          setWorkspace(parsed);
          setSelectedShareId(parsed.records.find((record) => !record.deletedAt)?.id ?? seedState.records[0]?.id ?? "");
        } catch {
          window.localStorage.removeItem(storageKey);
        }
      }

      setStorageReady(true);
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      return;
    }

    let cancelled = false;

    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) {
        return;
      }
      setAuthUser(data.session?.user ?? null);
      setAuthReady(true);
      setCloudStatus(data.session?.user ? "checking" : "local");
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuthUser(session?.user ?? null);
      cloudLoadedRef.current = false;
      setCloudStatus(session?.user ? "checking" : "local");
    });

    return () => {
      cancelled = true;
      listener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    return () => {
      const recorder = mediaRecorderRef.current;
      if (recorder && recorder.state !== "inactive") {
        recorder.stream.getTracks().forEach((track) => track.stop());
        recorder.stop();
      }
    };
  }, []);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase || !authUser || !authReady || !storageReady || cloudLoadedRef.current) {
      return;
    }

    const activeSupabase = supabase;
    const activeUser = authUser;
    let cancelled = false;

    async function loadCloudWorkspace() {
      setCloudStatus("checking");
      const email = activeUser.email ?? "";
      const profilePayload = {
        id: activeUser.id,
        email,
        name: workspace.profile.name,
        role: "broker",
        timezone: workspace.profile.timezone || riyadhTimezone,
        invite_only: true,
        smtp_ready: workspace.profile.smtpReady,
      };

      const profileResult = await activeSupabase.from("profiles").upsert(profilePayload, { onConflict: "id" }).select("id").maybeSingle();
      if (profileResult.error) {
        if (!cancelled) {
          setCloudStatus("blocked");
          setAuthMessage("تم تسجيل الدخول، لكن الحساب غير موجود في الدعوات أو لا يملك صلاحية إنشاء ملف. أضف دعوة لهذا البريد من Supabase.");
        }
        return;
      }

      const { data, error } = await activeSupabase.from("workspace_snapshots").select("state").eq("user_id", activeUser.id).maybeSingle();
      if (cancelled) {
        return;
      }

      if (error) {
        setCloudStatus("error");
        setAuthMessage("تعذر تحميل البيانات السحابية. تحقق من RLS والمigrations.");
        return;
      }

      if (data?.state && typeof data.state === "object") {
        const cloudWorkspace = normalizeWorkspaceState(data.state as WorkspaceState);
        setWorkspace(cloudWorkspace);
        setSelectedShareId(cloudWorkspace.records.find((record) => !record.deletedAt)?.id ?? seedState.records[0]?.id ?? "");
      }

      cloudLoadedRef.current = true;
      setCloudStatus("synced");
      setAuthMessage("تم الاتصال بقاعدة البيانات وحفظ البيانات سحابياً لهذا الحساب.");
    }

    void loadCloudWorkspace();

    return () => {
      cancelled = true;
    };
  }, [authReady, authUser, storageReady, workspace.profile.name, workspace.profile.smtpReady, workspace.profile.timezone]);

  useEffect(() => {
    if (storageReady) {
      window.localStorage.setItem(storageKey, JSON.stringify(workspace));
    }
  }, [storageReady, workspace]);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase || !authUser || !storageReady || !cloudLoadedRef.current || cloudStatus === "blocked") {
      return;
    }

    const timer = window.setTimeout(() => {
      supabase
        .from("workspace_snapshots")
        .upsert({ user_id: authUser.id, state: workspace, version: 1 }, { onConflict: "user_id" })
        .then(({ error }) => {
          if (error) {
            setCloudStatus("error");
            setAuthMessage("تعذر حفظ آخر تغيير في قاعدة البيانات.");
            return;
          }
          setCloudStatus("synced");
        });
    }, 700);

    return () => window.clearTimeout(timer);
  }, [authUser, cloudStatus, storageReady, workspace]);

  const activeRecords = useMemo(() => workspace.records.filter((record) => !record.deletedAt), [workspace.records]);
  const trashedRecords = useMemo(() => workspace.records.filter((record) => record.deletedAt), [workspace.records]);
  const offers = useMemo(() => activeRecords.filter((record) => record.kind === "offer"), [activeRecords]);
  const requests = useMemo(() => activeRecords.filter((record) => record.kind === "request"), [activeRecords]);
  const cities = useMemo(() => Array.from(new Set(activeRecords.map((record) => record.city))).filter(Boolean), [activeRecords]);
  const unreadNotifications = workspace.notifications.filter((notification) => !notification.read).length;
  const dueReminders = workspace.reminders.filter((reminder) => reminder.status === "due").length;
  const selectedShareRecord = activeRecords.find((record) => record.id === selectedShareId) ?? activeRecords[0] ?? null;

  function toMapRecord(record: PropertyRecord): MapRecord {
    return {
      id: record.id,
      recordType: record.kind,
      status: record.status,
      statusLabel: statusLabels[record.status],
      propertyType: record.propertyType,
      city: record.city,
      district: record.district,
      price: record.price,
      budget: record.budget,
      area: record.area,
      latitude: record.lat,
      longitude: record.lng,
      detailsUrl: `#record-${record.id}`,
    };
  }

  function selectMapRecord(recordId: string) {
    setSelectedShareId(recordId);
    window.setTimeout(() => {
      document.getElementById(`record-${recordId}`)?.scrollIntoView({ block: "center", behavior: "smooth" });
    }, 30);
  }

  function updateRecord(recordId: string, patch: Partial<PropertyRecord>) {
    setWorkspace((current) => ({
      ...current,
      records: current.records.map((record) =>
        record.id === recordId ? { ...record, ...patch, updatedAt: nowIso() } : record,
      ),
    }));
  }

  function addNotification(title: string, body: string, level: NotificationLevel = "info") {
    setWorkspace((current) => ({
      ...current,
      notifications: [
        {
          id: makeId("note"),
          title,
          body,
          level,
          createdAt: nowIso(),
          read: false,
        },
        ...current.notifications,
      ],
    }));
  }

  async function sendLoginLink(formData: FormData) {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setAuthMessage("إعدادات Supabase غير متاحة في المتصفح.");
      return;
    }

    const email = String(formData.get("email") ?? authEmail).trim().toLowerCase();
    if (!email) {
      setAuthMessage("أدخل البريد الإلكتروني أولاً.");
      return;
    }

    setAuthEmail(email);
    setAuthMessage("جاري إرسال رابط الدخول...");
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin },
    });

    setAuthMessage(error ? "تعذر إرسال رابط الدخول. تحقق من إعدادات Auth/SMTP في Supabase." : "تم إرسال رابط الدخول إذا كان البريد مسموحاً.");
  }

  async function registerWithEmail(formData: FormData) {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setAuthMessage("إعدادات Supabase غير متاحة في المتصفح.");
      return;
    }

    const email = String(formData.get("email") ?? authEmail).trim().toLowerCase();
    const password = String(formData.get("password") ?? authPassword);
    const name = String(formData.get("name") ?? authName).trim();
    if (!email || password.length < 8) {
      setAuthMessage("أدخل بريداً صحيحاً وكلمة مرور لا تقل عن 8 أحرف.");
      return;
    }

    setAuthEmail(email);
    setAuthPassword(password);
    setAuthName(name);
    setAuthMessage("جاري إنشاء الحساب وإرسال رسالة التأكيد...");

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin,
        data: { name },
      },
    });

    setAuthMessage(
      error
        ? "تعذر إنشاء الحساب. تحقق من إعدادات Auth أو الدعوة أو قوة كلمة المرور."
        : "تم إنشاء الحساب. افتح بريدك واضغط رابط التأكيد، ثم سجّل الدخول.",
    );
  }

  async function signInWithEmail(formData: FormData) {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setAuthMessage("إعدادات Supabase غير متاحة في المتصفح.");
      return;
    }

    const email = String(formData.get("email") ?? authEmail).trim().toLowerCase();
    const password = String(formData.get("password") ?? authPassword);
    if (!email || !password) {
      setAuthMessage("أدخل البريد وكلمة المرور.");
      return;
    }

    setAuthEmail(email);
    setAuthPassword(password);
    setAuthMessage("جاري تسجيل الدخول...");
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setAuthMessage(error ? "تعذر تسجيل الدخول. تأكد من تأكيد البريد وصحة كلمة المرور." : "تم تسجيل الدخول بنجاح.");
  }

  async function signOut() {
    const supabase = getSupabaseBrowserClient();
    await supabase?.auth.signOut();
    setAuthUser(null);
    setCloudStatus("local");
    cloudLoadedRef.current = false;
    setAuthMessage("تم تسجيل الخروج. البيانات الحالية محفوظة محلياً على هذا الجهاز.");
  }

  function addRecord(kind: RecordKind, formData: FormData) {
    const clientId = String(formData.get("clientId") ?? workspace.clients[0]?.id ?? "");
    const title = String(formData.get("title") ?? "").trim();
    const priceValue = Number(formData.get("price") || 0);
    const areaValue = Number(formData.get("area") || 0);
    const latitudeValue = Number(formData.get("latitude") || Number.NaN);
    const longitudeValue = Number(formData.get("longitude") || Number.NaN);
    const hasCoordinates = hasUsableCoordinates(latitudeValue, longitudeValue);
    const transaction = String(formData.get("transaction") || (kind === "offer" ? "بيع" : "شراء"));
    const record: PropertyRecord = {
      id: makeId("rec"),
      kind,
      title: title || (kind === "offer" ? "عرض جديد" : "طلب جديد"),
      propertyType: String(formData.get("propertyType") || "غير محدد"),
      transaction,
      status: defaultStatusForRecord(kind, transaction),
      city: String(formData.get("city") || "الرياض"),
      district: String(formData.get("district") || "غير محدد"),
      area: areaValue > 0 ? areaValue : null,
      price: kind === "offer" && priceValue > 0 ? priceValue : null,
      budget: kind === "request" && priceValue > 0 ? priceValue : null,
      streetWidth: null,
      facade: "",
      bedrooms: null,
      bathrooms: null,
      clientId,
      contact: workspace.clients.find((client) => client.id === clientId)?.phone ?? "",
      license: "",
      notes: String(formData.get("notes") || ""),
      tags: kind === "offer" ? ["عرض يدوي"] : ["طلب يدوي"],
      source: "manual",
      lat: hasCoordinates ? latitudeValue : null,
      lng: hasCoordinates ? longitudeValue : null,
      createdAt: nowIso(),
      updatedAt: nowIso(),
      sharedAt: null,
      deletedAt: null,
    };

    setWorkspace((current) => ({ ...current, records: [record, ...current.records] }));
    setSelectedShareId(record.id);
    setRecordFormVersion((value) => value + 1);
    addNotification("تم إنشاء سجل", `تم حفظ ${recordKindLabels[kind]}: ${record.title}`, "success");
  }

  function addClient(formData: FormData) {
    const client: ClientRecord = {
      id: makeId("client"),
      name: String(formData.get("name") || "عميل جديد"),
      phone: normalizePhone(String(formData.get("phone") || "")),
      type: String(formData.get("type") || "buyer") as ClientRecord["type"],
      priority: String(formData.get("priority") || "medium") as ClientRecord["priority"],
      notes: String(formData.get("notes") || ""),
      lastContactAt: nowIso(),
    };

    setWorkspace((current) => ({ ...current, clients: [client, ...current.clients] }));
    addNotification("عميل جديد", `تمت إضافة ${client.name} إلى CRM.`, "success");
  }

  function addReminder(recordId: string) {
    const record = activeRecords.find((item) => item.id === recordId);
    if (!record) {
      return;
    }

    const dueAt = new Date();
    dueAt.setDate(dueAt.getDate() + 14);
    setWorkspace((current) => ({
      ...current,
      reminders: [
        {
          id: makeId("rem"),
          recordId,
          title: `متابعة ${record.title}`,
          dueAt: dueAt.toISOString(),
          status: "scheduled",
        },
        ...current.reminders,
      ],
    }));
    addNotification("تم إنشاء تذكير", `موعد المتابعة بعد 14 يوماً حسب توقيت ${workspace.profile.timezone}.`, "success");
  }

  function filteredActiveRecords(kind?: RecordKind) {
    const query = filters.query.trim().toLowerCase();
    const effectiveStatus =
      kind && filters.status !== "all" && !statusOptionsByKind[kind].some((option) => option.value === filters.status)
        ? "all"
        : filters.status;

    return activeRecords.filter((record) => {
      const matchesKind = kind === undefined || record.kind === kind;
      const matchesStatus = effectiveStatus === "all" || record.status === effectiveStatus;
      const matchesCity = filters.city === "all" || record.city === filters.city;
      const matchesQuery =
        !query ||
        [record.title, record.city, record.district, record.propertyType, record.transaction, record.notes, record.contact]
          .join(" ")
          .toLowerCase()
          .includes(query);
      return matchesKind && matchesStatus && matchesCity && matchesQuery;
    });
  }

  function filteredRecords(kind: RecordKind) {
    return filteredActiveRecords(kind);
  }

  async function readJsonResponse<T>(response: Response): Promise<T & { error?: string }> {
    try {
      return (await response.json()) as T & { error?: string };
    } catch {
      return { error: "تعذر قراءة استجابة الخادم." } as T & { error?: string };
    }
  }

  async function analyzeText(value = aiText) {
    const cleanText = value.trim();
    if (!cleanText) {
      setAiError("أدخل نصاً عقارياً أولاً.");
      return;
    }

    setAiBusy(true);
    setAiError(null);
    try {
      const response = await fetch("/api/extract-property", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: cleanText }),
      });
      const body = await readJsonResponse<PropertyData>(response);
      if (!response.ok) {
        throw new Error(body.error ?? "فشل تحليل النص.");
      }
      setAiSource("ai-text");
      setAiResult(body);
    } catch (error) {
      setAiError(error instanceof Error ? error.message : "حدث خطأ غير متوقع.");
    } finally {
      setAiBusy(false);
    }
  }

  async function transcribeAudio(audio: Blob, filename = "recording.webm") {
    setAiBusy(true);
    setAiError(null);
    try {
      const formData = new FormData();
      formData.append("audio", audio, filename);
      const response = await fetch("/api/transcribe", { method: "POST", body: formData });
      const body = await readJsonResponse<{ text: string }>(response);
      if (!response.ok) {
        throw new Error(body.error ?? "فشل تحويل الصوت إلى نص.");
      }
      setAiText(body.text);
      setAiSource("ai-voice");
      await analyzeText(body.text);
    } catch (error) {
      setAiError(error instanceof Error ? error.message : "حدث خطأ غير متوقع.");
    } finally {
      setAiBusy(false);
    }
  }

  async function startAudioRecording() {
    setAiError(null);
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setAiError("المتصفح لا يدعم التسجيل الصوتي المباشر. جرّب Chrome أو Edge محدثاً.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, { mimeType: MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : undefined });
      audioChunksRef.current = [];
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        setIsRecording(false);
        const audioBlob = new Blob(audioChunksRef.current, { type: recorder.mimeType || "audio/webm" });
        audioChunksRef.current = [];
        mediaRecorderRef.current = null;
        if (audioBlob.size > 0) {
          void transcribeAudio(audioBlob);
        }
      };

      recorder.start();
      setIsRecording(true);
    } catch {
      setAiError("تعذر بدء التسجيل. تأكد من السماح باستخدام الميكروفون.");
      setIsRecording(false);
    }
  }

  function stopAudioRecording() {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      recorder.stop();
    }
  }

  function saveAiRecord() {
    if (!aiResult) {
      return;
    }

    const record = mapAiToRecord(aiResult, aiSource, workspace.clients);
    setWorkspace((current) => ({ ...current, records: [record, ...current.records] }));
    setSelectedShareId(record.id);
    setView(record.kind === "offer" ? "offers" : "requests");
    addNotification("تم حفظ إدخال AI", `تم تحويل النص إلى ${recordKindLabels[record.kind]} قابل للمراجعة.`, "success");
  }

  function markShared(recordId: string) {
    const record = activeRecords.find((item) => item.id === recordId);
    updateRecord(recordId, { sharedAt: nowIso() });
    addNotification("تم تجهيز مشاركة", record ? `تم تسجيل مشاركة ${record.title}.` : "تم تسجيل المشاركة.", "success");
  }

  function renderMetric(label: string, value: string | number, tone: "teal" | "blue" | "amber" | "slate", icon: LucideIcon) {
    const Icon = icon;
    return (
      <div className={metricClass(tone)}>
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm font-bold">{label}</span>
          <Icon className="size-5" aria-hidden="true" />
        </div>
        <p className="mt-3 text-3xl font-black">{value}</p>
      </div>
    );
  }

  function calculateOfferCosts(price: number | null) {
    const basePrice = price ?? 0;
    const rett = basePrice * 0.05;
    const commission = basePrice * 0.025;
    const vatOnCommission = commission * 0.15;
    const total = basePrice + rett + commission + vatOnCommission;

    return { basePrice, rett, commission, vatOnCommission, total };
  }

  function renderOfferCalculator(record: PropertyRecord) {
    const costs = calculateOfferCosts(record.price);

    return (
      <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50 p-4">
        <div className="mb-3 flex items-center gap-2 text-blue-950">
          <Calculator className="size-4" aria-hidden="true" />
          <p className="font-black">التفاصيل المالية للعرض</p>
        </div>
        <div className="grid gap-2 text-sm font-bold text-slate-800 sm:grid-cols-2">
          <span>سعر العقار: {formatMoney(costs.basePrice)}</span>
          <span>ضريبة التصرفات 5%: {formatMoney(costs.rett)}</span>
          <span>عمولة الوساطة 2.5%: {formatMoney(costs.commission)}</span>
          <span>VAT على العمولة 15%: {formatMoney(costs.vatOnCommission)}</span>
        </div>
        <p className="mt-3 rounded-md bg-white p-3 text-lg font-black text-blue-900">الإجمالي التقديري: {formatMoney(costs.total)}</p>
      </div>
    );
  }

  function renderRecordCard(record: PropertyRecord) {
    const client = workspace.clients.find((item) => item.id === record.clientId);
    return (
      <article key={record.id} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-bold text-slate-700">
                {recordKindLabels[record.kind]}
              </span>
              <span className="rounded-md bg-teal-50 px-2 py-1 text-xs font-bold text-teal-800">
                {statusLabels[record.status]}
              </span>
            </div>
            <h3 className="mt-3 text-lg font-black text-slate-950">{record.title}</h3>
            <p className="mt-1 text-sm text-slate-600">
              {record.city}، {record.district} | {record.propertyType} | {record.transaction}
            </p>
          </div>
          <p className="text-lg font-black text-slate-950">{formatMoney(recordAmount(record))}</p>
        </div>
        <div className="mt-4 grid gap-2 text-sm text-slate-700 sm:grid-cols-3">
          <span>المساحة: {record.area ? `${record.area} م²` : "غير محدد"}</span>
          <span>الواجهة: {record.facade || "غير محدد"}</span>
          <span>العميل: {client?.name ?? "غير مرتبط"}</span>
        </div>
        <p className="mt-3 line-clamp-2 text-sm leading-7 text-slate-600">{record.notes || "لا توجد ملاحظات."}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" onClick={() => addReminder(record.id)} className="action-button">
            <CalendarClock className="size-4" aria-hidden="true" />
            تذكير
          </button>
          <button
            type="button"
            onClick={() => {
              setSelectedShareId(record.id);
              setProfileSection("sharing");
              setView("admin");
            }}
            className="action-button"
          >
            <Share2 className="size-4" aria-hidden="true" />
            مشاركة
          </button>
          {record.kind === "offer" && view === "offers" ? (
            <button
              type="button"
              onClick={() => setExpandedCalculatorRecordId((current) => (current === record.id ? null : record.id))}
              className="action-button border-blue-200 bg-blue-50 text-blue-800 hover:border-blue-300"
            >
              <Calculator className="size-4" aria-hidden="true" />
              الحاسبة
            </button>
          ) : null}
          <select
            value={record.status}
            onChange={(event) => updateRecord(record.id, { status: event.target.value as RecordStatus })}
            className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm"
          >
            {statusOptionsByKind[record.kind].map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <button type="button" onClick={() => updateRecord(record.id, { deletedAt: nowIso() })} className="danger-button">
            <Trash2 className="size-4" aria-hidden="true" />
            حذف
          </button>
        </div>
        {record.kind === "offer" && view === "offers" && expandedCalculatorRecordId === record.id ? renderOfferCalculator(record) : null}
      </article>
    );
  }

  function renderRecordWorkspace(kind: RecordKind) {
    const records = filteredRecords(kind);
    const selectedStatusFilter =
      filters.status !== "all" && statusOptionsByKind[kind].some((option) => option.value === filters.status)
        ? filters.status
        : "all";

    return (
      <section className="grid gap-4">
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-4 flex items-center gap-2 text-slate-950">
            <Filter className="size-5" aria-hidden="true" />
            <h2 className="text-lg font-black">بحث وفلاتر {kind === "offer" ? "العروض" : "الطلبات"}</h2>
          </div>
          <div className="grid gap-3 md:grid-cols-4">
            <input
              value={filters.query}
              onChange={(event) => setFilters((current) => ({ ...current, query: event.target.value }))}
              placeholder="بحث بالحي، العميل، الوصف..."
              className={fieldClass()}
            />
            <select
              value={selectedStatusFilter}
              onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value as FilterState["status"] }))}
              className={fieldClass()}
            >
              <option value="all">كل الحالات</option>
              {statusOptionsByKind[kind].map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <select
              value={filters.city}
              onChange={(event) => setFilters((current) => ({ ...current, city: event.target.value }))}
              className={fieldClass()}
            >
              <option value="all">كل المدن</option>
              {cities.map((city) => (
                <option key={city} value={city}>
                  {city}
                </option>
              ))}
            </select>
            <button type="button" onClick={() => setView("ai")} className="primary-button">
              <Sparkles className="size-4" aria-hidden="true" />
              إدخال AI
            </button>
          </div>
        </div>

        <form
          className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
          onSubmit={(event) => {
            event.preventDefault();
            addRecord(kind, new FormData(event.currentTarget));
            event.currentTarget.reset();
          }}
        >
          <div className="mb-4 flex items-center gap-2">
            <Plus className="size-5 text-teal-700" aria-hidden="true" />
            <h2 className="text-lg font-black text-slate-950">إضافة {recordKindLabels[kind]} سريع</h2>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            <input name="title" placeholder="العنوان" className={fieldClass()} />
            <input name="city" placeholder="المدينة" defaultValue="الرياض" className={fieldClass()} />
            <input name="district" placeholder="الحي" className={fieldClass()} />
            <input name="propertyType" placeholder="نوع العقار" className={fieldClass()} />
            <input name="transaction" placeholder="نوع العملية" defaultValue={kind === "offer" ? "بيع" : "شراء"} className={fieldClass()} />
            <input name="price" type="number" min="0" placeholder={kind === "offer" ? "السعر" : "الميزانية"} className={fieldClass()} />
            <input name="area" type="number" min="0" placeholder="المساحة" className={fieldClass()} />
            <select name="clientId" className={fieldClass()}>
              {workspace.clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name}
                </option>
              ))}
            </select>
            <input name="notes" placeholder="ملاحظات" className={fieldClass()} />
            <LocationPicker key={`${kind}-${recordFormVersion}`} />
          </div>
          <div className="mt-4 flex justify-end">
            <button type="submit" className="primary-button">
              <Plus className="size-4" aria-hidden="true" />
              حفظ
            </button>
          </div>
        </form>

        <div className="grid gap-3">{records.length > 0 ? records.map(renderRecordCard) : <EmptyState label="لا توجد سجلات مطابقة." />}</div>
      </section>
    );
  }

  function renderDashboard() {
    const totalValue = offers.reduce((sum, record) => sum + (record.price ?? 0), 0);
    return (
      <section className="grid gap-4">
        <div className="grid gap-3 md:grid-cols-4">
          {renderMetric("العروض المتاحة", offers.filter((record) => record.status === "for_sale" || record.status === "for_rent").length, "teal", Building2)}
          {renderMetric("الطلبات المفتوحة", requests.filter((record) => record.status === "purchase" || record.status === "rental").length, "blue", Search)}
          {renderMetric("تذكيرات مستحقة", dueReminders, "amber", CalendarClock)}
          {renderMetric("قيمة العروض", formatMoney(totalValue), "slate", CircleDollarSign)}
        </div>
        <div className="grid gap-4 xl:grid-cols-[1.3fr_0.7fr]">
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="mb-3 text-lg font-black text-slate-950">آخر السجلات</h2>
            <div className="grid gap-3">{activeRecords.slice(0, 4).map(renderRecordCard)}</div>
          </div>
          <div className="grid content-start gap-4">
            <Panel title="الجاهزية">
              <ReadinessRow ok label="المشروع داخل Git مستقل" />
              <ReadinessRow ok label="المفاتيح من env فقط" />
              <ReadinessRow ok={workspace.profile.inviteOnly} label="المصادقة بالدعوات للـ MVP" />
              <ReadinessRow ok={workspace.profile.smtpReady} label="SMTP جاهز للإنتاج" />
            </Panel>
            <Panel title="تنبيهات اليوم">
              {workspace.notifications.slice(0, 4).map((item) => (
                <div key={item.id} className="rounded-md border border-slate-200 bg-slate-50 p-3">
                  <p className="font-bold text-slate-950">{item.title}</p>
                  <p className="mt-1 text-sm leading-6 text-slate-600">{item.body}</p>
                </div>
              ))}
            </Panel>
          </div>
        </div>
      </section>
    );
  }

  function renderAiEntry() {
    return (
      <section className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <WandSparkles className="size-5 text-teal-700" aria-hidden="true" />
            <h2 className="text-lg font-black text-slate-950">إدخال ذكي من النص أو الصوت</h2>
          </div>
          <textarea
            value={aiText}
            onChange={(event) => setAiText(event.target.value)}
            maxLength={6000}
            rows={9}
            placeholder="الصق رسالة عقارية عربية هنا..."
            className="w-full resize-y rounded-md border border-slate-300 bg-slate-50 p-3 leading-8 outline-none focus:border-teal-700 focus:bg-white focus:ring-2 focus:ring-teal-600/20"
          />
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <span className="text-sm text-slate-500">{aiText.length} / 6000</span>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => (isRecording ? stopAudioRecording() : void startAudioRecording())}
                disabled={aiBusy}
                className={isRecording ? "danger-button" : "secondary-button"}
              >
                <Mic2 className="size-4" aria-hidden="true" />
                {isRecording ? "إيقاف التسجيل وتحويله لنص" : "تسجيل صوتي مباشر"}
              </button>
              <button type="button" onClick={() => void analyzeText()} disabled={aiBusy || !aiText.trim()} className="primary-button">
                <Sparkles className="size-4" aria-hidden="true" />
                {aiBusy ? "جاري التحليل" : "تحليل"}
              </button>
            </div>
          </div>
          {isRecording ? <p className="mt-3 rounded-md border border-rose-200 bg-rose-50 p-3 text-sm font-bold text-rose-800">التسجيل يعمل الآن... تحدث ثم اضغط إيقاف التسجيل.</p> : null}
          {aiError ? <p className="mt-3 rounded-md border border-rose-200 bg-rose-50 p-3 text-sm font-bold text-rose-800">{aiError}</p> : null}
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="mb-4 text-lg font-black text-slate-950">نتيجة المراجعة قبل الحفظ</h2>
          {aiResult ? (
            <div className="grid gap-3">
              <div className="grid gap-3 md:grid-cols-2">
                <Info label="نوع السجل" value={recordKindLabels[aiResult.recordType]} />
                <Info label="نوع العملية" value={aiResult.transactionType ? transactionLabels[aiResult.transactionType] : "غير محدد"} />
                <Info label="نوع العقار" value={aiResult.propertyType ? propertyTypeLabels[aiResult.propertyType] : "غير محدد"} />
                <Info label="المدينة" value={aiResult.city ?? "غير محدد"} />
                <Info label="الأحياء" value={aiResult.districts.join("، ") || "غير محدد"} />
                <Info label="القيمة" value={formatMoney(aiResult.price ?? aiResult.maximumBudget)} />
              </div>
              <Info label="الوصف" value={aiResult.description ?? "غير محدد"} />
              <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
                الحقول الناقصة: {aiResult.missingFields.join("، ") || "لا توجد"}
              </div>
              <button type="button" onClick={saveAiRecord} className="primary-button justify-center">
                <CheckCircle2 className="size-4" aria-hidden="true" />
                حفظ كسجل قابل للإدارة
              </button>
            </div>
          ) : (
            <EmptyState label="ستظهر نتيجة التحليل هنا بعد تشغيل AI." />
          )}
        </div>
      </section>
    );
  }

  function renderMap() {
    const mapListRecords = filteredActiveRecords();
    const mapRecords = filterMapRecords(mapListRecords.map(toMapRecord), filters);
    const visibleRecordIds = new Set(mapRecords.map((record) => record.id));
    const visibleRecords = mapListRecords.filter((record) => visibleRecordIds.has(record.id));

    return (
      <section className="grid gap-4 xl:grid-cols-[0.82fr_1.18fr]">
        <div className="xl:hidden">
          <button type="button" onClick={() => setIsMobileMapOpen(true)} className="primary-button w-full justify-center">
            <MapPinned className="size-4" aria-hidden="true" />
            عرض الخريطة
          </button>
        </div>
        <Panel title="سجلات الخريطة">
          <div className="grid gap-3 xl:max-h-[calc(100vh-10rem)] xl:overflow-auto xl:pl-1">
            {visibleRecords.length > 0 ? (
              visibleRecords.map((record) => (
              <button
                id={`record-${record.id}`}
                key={record.id}
                type="button"
                onClick={() => selectMapRecord(record.id)}
                onMouseEnter={() => setHoveredMapId(record.id)}
                onMouseLeave={() => setHoveredMapId(null)}
                className={[
                  "rounded-md border bg-white p-3 text-right transition hover:border-teal-300 hover:bg-teal-50",
                  selectedShareId === record.id ? "border-teal-500 ring-2 ring-teal-500/20" : "border-slate-200",
                ].join(" ")}
              >
                <p className="font-black text-slate-950">{record.title}</p>
                <p className="mt-1 text-sm text-slate-600">
                  {record.city}، {record.district} | {recordKindLabels[record.kind]} | {statusLabels[record.status]}
                </p>
                <p className="mt-2 text-sm font-bold text-slate-900">{formatMoney(recordAmount(record))}</p>
              </button>
              ))
            ) : (
              <EmptyState label="لا توجد سجلات مطابقة بإحداثيات صالحة." />
            )}
          </div>
        </Panel>
        <div
          className={[
            "xl:sticky xl:top-24 xl:block xl:h-[calc(100vh-8rem)]",
            isMobileMapOpen ? "fixed inset-0 z-50 bg-white p-3" : "hidden",
          ].join(" ")}
        >
          {isMobileMapOpen ? (
            <button type="button" onClick={() => setIsMobileMapOpen(false)} className="secondary-button mb-3 w-full justify-center xl:hidden">
              العودة إلى القائمة
            </button>
          ) : null}
          <RealEstateMap
            records={mapRecords}
            selectedId={selectedShareId}
            hoveredId={hoveredMapId}
            onSelect={selectMapRecord}
            className="h-full"
          />
        </div>
      </section>
    );
  }

  function renderClients() {
    return (
      <section className="grid gap-4 xl:grid-cols-[0.85fr_1.15fr]">
        <form
          className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
          onSubmit={(event) => {
            event.preventDefault();
            addClient(new FormData(event.currentTarget));
            event.currentTarget.reset();
          }}
        >
          <div className="mb-4 flex items-center gap-2">
            <UserPlus className="size-5 text-teal-700" aria-hidden="true" />
            <h2 className="text-lg font-black text-slate-950">إضافة عميل</h2>
          </div>
          <div className="grid gap-3">
            <input name="name" required placeholder="اسم العميل" className={fieldClass()} />
            <input name="phone" placeholder="رقم الجوال" className={fieldClass()} />
            <select name="type" className={fieldClass()}>
              <option value="buyer">مشتري</option>
              <option value="owner">مالك</option>
              <option value="tenant">مستأجر</option>
              <option value="broker">وسيط</option>
            </select>
            <select name="priority" className={fieldClass()}>
              <option value="high">أولوية عالية</option>
              <option value="medium">أولوية متوسطة</option>
              <option value="low">أولوية منخفضة</option>
            </select>
            <textarea name="notes" rows={4} placeholder="ملاحظات CRM" className={`${fieldClass()} h-auto py-3 leading-7`} />
            <button type="submit" className="primary-button justify-center">
              <Plus className="size-4" aria-hidden="true" />
              حفظ العميل
            </button>
          </div>
        </form>
        <div className="grid gap-3">
          {workspace.clients.map((client) => (
            <article key={client.id} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="text-lg font-black text-slate-950">{client.name}</h3>
                  <p className="mt-1 text-sm text-slate-600">
                    {clientTypeLabels[client.type]} | {client.phone || "لا يوجد رقم"}
                  </p>
                </div>
                <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-bold text-slate-700">{client.priority}</span>
              </div>
              <p className="mt-3 text-sm leading-7 text-slate-600">{client.notes}</p>
              <p className="mt-3 text-xs text-slate-500">آخر تواصل: {formatDateTime(client.lastContactAt, workspace.profile.timezone)}</p>
            </article>
          ))}
        </div>
      </section>
    );
  }

  function renderReminders() {
    return (
      <Panel title="التذكيرات حسب توقيت المستخدم">
        <div className="grid gap-3">
          {workspace.reminders.map((reminder) => {
            const record = workspace.records.find((item) => item.id === reminder.recordId);
            return (
              <div key={reminder.id} className="rounded-lg border border-slate-200 bg-white p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-black text-slate-950">{reminder.title}</p>
                    <p className="mt-1 text-sm text-slate-600">{record?.title ?? "سجل محذوف"}</p>
                    <p className="mt-1 text-sm text-slate-500">{formatDateTime(reminder.dueAt, workspace.profile.timezone)}</p>
                  </div>
                  <select
                    value={reminder.status}
                    onChange={(event) =>
                      setWorkspace((current) => ({
                        ...current,
                        reminders: current.reminders.map((item) =>
                          item.id === reminder.id ? { ...item, status: event.target.value as ReminderStatus } : item,
                        ),
                      }))
                    }
                    className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm"
                  >
                    <option value="scheduled">مجدول</option>
                    <option value="due">مستحق</option>
                    <option value="completed">مكتمل</option>
                  </select>
                </div>
              </div>
            );
          })}
        </div>
      </Panel>
    );
  }

  function renderNotifications() {
    return (
      <Panel title="مركز الإشعارات">
        <div className="mb-3 flex justify-end">
          <button
            type="button"
            onClick={() =>
              setWorkspace((current) => ({
                ...current,
                notifications: current.notifications.map((item) => ({ ...item, read: true })),
              }))
            }
            className="secondary-button"
          >
            <CheckCircle2 className="size-4" aria-hidden="true" />
            تعليم الكل كمقروء
          </button>
        </div>
        <div className="grid gap-3">
          {workspace.notifications.map((item) => (
            <div key={item.id} className={`rounded-lg border p-4 ${item.read ? "border-slate-200 bg-white" : "border-teal-200 bg-teal-50"}`}>
              <p className="font-black text-slate-950">{item.title}</p>
              <p className="mt-1 text-sm leading-7 text-slate-600">{item.body}</p>
              <p className="mt-2 text-xs text-slate-500">{formatDateTime(item.createdAt, workspace.profile.timezone)}</p>
            </div>
          ))}
        </div>
      </Panel>
    );
  }

  function renderSharing() {
    const text = selectedShareRecord ? recordShareText(selectedShareRecord) : "";
    const whatsappUrl = selectedShareRecord
      ? `https://wa.me/?text=${encodeURIComponent(text)}`
      : "#";
    const xUrl = selectedShareRecord
      ? `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`
      : "#";

    return (
      <section className="grid gap-4 xl:grid-cols-[0.8fr_1.2fr]">
        <Panel title="اختيار سجل للمشاركة">
          <select value={selectedShareRecord?.id ?? ""} onChange={(event) => setSelectedShareId(event.target.value)} className={fieldClass()}>
            {activeRecords.map((record) => (
              <option key={record.id} value={record.id}>
                {record.title}
              </option>
            ))}
          </select>
          <div className="mt-4 grid gap-2">
            <a href={whatsappUrl} target="_blank" rel="noreferrer" onClick={() => selectedShareRecord && markShared(selectedShareRecord.id)} className="primary-button justify-center">
              <MessageCircle className="size-4" aria-hidden="true" />
              فتح واتساب
            </a>
            <a href={xUrl} target="_blank" rel="noreferrer" onClick={() => selectedShareRecord && markShared(selectedShareRecord.id)} className="secondary-button justify-center">
              <Send className="size-4" aria-hidden="true" />
              مشاركة عبر X
            </a>
            <button
              type="button"
              onClick={() => {
                void navigator.clipboard?.writeText(text);
                if (selectedShareRecord) markShared(selectedShareRecord.id);
              }}
              className="secondary-button justify-center"
            >
              <ClipboardCopy className="size-4" aria-hidden="true" />
              نسخ النص
            </button>
          </div>
        </Panel>
        <Panel title="نص المشاركة">
          <pre className="min-h-64 whitespace-pre-wrap rounded-md border border-slate-200 bg-slate-50 p-4 leading-8 text-slate-800">
            {text || "اختر سجلاً لتجهيز نص المشاركة."}
          </pre>
          <p className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm leading-7 text-amber-950">
            روابط المشاركة العامة و /s/[token] مؤجلة للمرحلة الثانية إلا إذا أصبحت لازمة لتدفق المشاركة المعتمد.
          </p>
        </Panel>
      </section>
    );
  }

  function renderTrash() {
    return (
      <Panel title="سلة المهملات - حذف ناعم 30 يوماً">
        <div className="grid gap-3">
          {trashedRecords.length > 0 ? (
            trashedRecords.map((record) => (
              <div key={record.id} className="rounded-lg border border-slate-200 bg-white p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-black text-slate-950">{record.title}</p>
                    <p className="mt-1 text-sm text-slate-500">
                      حذف في {record.deletedAt ? formatDateTime(record.deletedAt, workspace.profile.timezone) : "غير محدد"}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => updateRecord(record.id, { deletedAt: null })} className="secondary-button">
                      <RotateCcw className="size-4" aria-hidden="true" />
                      استعادة
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setWorkspace((current) => ({
                          ...current,
                          records: current.records.filter((item) => item.id !== record.id),
                        }))
                      }
                      className="danger-button"
                    >
                      <XCircle className="size-4" aria-hidden="true" />
                      حذف نهائي
                    </button>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <EmptyState label="لا توجد عناصر في سلة المهملات." />
          )}
        </div>
      </Panel>
    );
  }

  function renderAdmin() {
    function renderAuthControls() {
      return (
        <Panel title="الدخول والتسجيل وتأكيد البريد">
          <div className="grid gap-3">
            <ReadinessRow ok={hasCloudPersistence} label="متغيرات Supabase العامة متاحة للمتصفح" />
            <ReadinessRow ok={Boolean(authUser)} label={authUser ? `مسجل دخول: ${authUser.email ?? "مستخدم"}` : "غير مسجل دخول"} />
            <ReadinessRow ok={cloudStatus === "synced"} label={`حالة قاعدة البيانات: ${cloudStatus}`} />
            {authUser ? (
              <button type="button" onClick={signOut} className="secondary-button justify-center">
                تسجيل الخروج
              </button>
            ) : (
              <>
                <div className="grid grid-cols-3 gap-2 rounded-lg bg-slate-100 p-1 text-sm font-bold">
                  {[
                    { id: "login", label: "دخول" },
                    { id: "register", label: "تسجيل" },
                    { id: "magic", label: "رابط سريع" },
                  ].map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setAuthMode(item.id as typeof authMode)}
                      className={[
                        "rounded-md px-3 py-2 transition",
                        authMode === item.id ? "bg-white text-teal-800 shadow-sm" : "text-slate-600 hover:bg-white/70",
                      ].join(" ")}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    const formData = new FormData(event.currentTarget);
                    if (authMode === "register") {
                      void registerWithEmail(formData);
                    } else if (authMode === "login") {
                      void signInWithEmail(formData);
                    } else {
                      void sendLoginLink(formData);
                    }
                  }}
                  className="grid gap-2"
                >
                  {authMode === "register" ? (
                    <input
                      name="name"
                      value={authName}
                      onChange={(event) => setAuthName(event.target.value)}
                      placeholder="اسم الوسيط"
                      className={fieldClass()}
                    />
                  ) : null}
                  <input
                    name="email"
                    type="email"
                    value={authEmail}
                    onChange={(event) => setAuthEmail(event.target.value)}
                    placeholder="البريد الإلكتروني"
                    className={fieldClass()}
                  />
                  {authMode !== "magic" ? (
                    <input
                      name="password"
                      type="password"
                      value={authPassword}
                      onChange={(event) => setAuthPassword(event.target.value)}
                      placeholder="كلمة المرور"
                      className={fieldClass()}
                    />
                  ) : null}
                  <button type="submit" className="primary-button justify-center" disabled={!hasCloudPersistence}>
                    {authMode === "register" ? "إنشاء حساب وإرسال التأكيد" : authMode === "login" ? "تسجيل الدخول" : "إرسال رابط الدخول"}
                  </button>
                </form>
              </>
            )}
            {authMessage ? <p className="rounded-md bg-slate-100 p-3 text-sm font-bold leading-7 text-slate-700">{authMessage}</p> : null}
            <p className="text-xs leading-6 text-slate-500">
              تأكيد البريد يتم عبر Supabase Auth. SMTP لا يوضع في الكود؛ يتم ضبطه من لوحة Supabase/Render باستخدام إعدادات آمنة خارج Git.
            </p>
          </div>
        </Panel>
      );
    }

    const sectionContent: Record<ProfileSection, React.ReactNode> = {
      settings: (
        <section className="grid gap-4 xl:grid-cols-2">
          <Panel title="إعدادات الحساب">
            <div className="grid gap-3">
              <Info label="المستخدم" value={workspace.profile.name} />
              <Info label="الدور" value={workspace.profile.role === "admin" ? "مدير" : "وسيط"} />
              <Info label="المنطقة الزمنية" value={workspace.profile.timezone} />
              <Info label="سياسة التسجيل" value={workspace.profile.inviteOnly ? "دعوات فقط" : "قابل للتسجيل العام لاحقاً"} />
            </div>
          </Panel>
          <Panel title="جاهزية الإنتاج">
            <ReadinessRow ok label="Git مستقل داخل مجلد المشروع" />
            <ReadinessRow ok label="المفاتيح لا تقرأ من ملفات fallback" />
            <ReadinessRow ok={workspace.profile.inviteOnly} label="MVP دعوات فقط مع قابلية توسيع لاحقة" />
            <ReadinessRow ok={workspace.profile.smtpReady} label="SMTP موثوق قبل الإنتاج" />
            <ReadinessRow ok={cloudStatus === "synced"} label="الحفظ السحابي عبر Supabase عند تسجيل الدخول" />
            <ReadinessRow ok label="البحث التقليدي والفلاتر قبل AI search" />
            <ReadinessRow ok label="سلة مهملات وحذف ناعم محلياً" />
          </Panel>
        </section>
      ),
      auth: renderAuthControls(),
      reminders: renderReminders(),
      notifications: renderNotifications(),
      sharing: renderSharing(),
      trash: renderTrash(),
    };

    return (
      <section className="grid gap-4">
        <div className="flex gap-2 overflow-x-auto rounded-lg border border-slate-200 bg-white p-2 shadow-sm">
          {profileSections.map((item) => {
            const Icon = item.icon;
            const count = item.id === "notifications" && unreadNotifications > 0 ? unreadNotifications : null;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setProfileSection(item.id)}
                className={[
                  "flex h-10 shrink-0 items-center gap-2 rounded-md px-3 text-sm font-bold transition",
                  profileSection === item.id ? "bg-teal-700 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200",
                ].join(" ")}
              >
                <Icon className="size-4" aria-hidden="true" />
                {item.label}
                {count ? <span className="rounded-full bg-amber-400 px-2 py-0.5 text-xs text-slate-950">{count}</span> : null}
              </button>
            );
          })}
        </div>
        {sectionContent[profileSection]}
      </section>
    );
  }

  function renderContent() {
    switch (view) {
      case "offers":
        return renderRecordWorkspace("offer");
      case "requests":
        return renderRecordWorkspace("request");
      case "ai":
        return renderAiEntry();
      case "map":
        return renderMap();
      case "clients":
        return renderClients();
      case "admin":
        return renderAdmin();
      default:
        return renderDashboard();
    }
  }

  const activeTitle = viewTitles[view];

  return (
    <main className="min-h-screen overflow-x-hidden bg-slate-100 text-slate-950">
      <div className="flex min-h-screen">
        <aside className="hidden w-72 shrink-0 border-l border-slate-200 bg-white lg:block">
          <div className="border-b border-slate-200 p-5">
            <p className="text-xs font-bold text-teal-700">مفكرة الوسيط</p>
            <h1 className="mt-1 text-xl font-black">إدارة الوساطة العقارية</h1>
          </div>
          <nav className="grid gap-1 p-3">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setView(item.id)}
                  className={[
                    "flex h-11 items-center gap-3 rounded-md px-3 text-sm font-bold transition",
                    view === item.id ? "bg-teal-700 text-white" : "text-slate-700 hover:bg-slate-100",
                  ].join(" ")}
                >
                  <Icon className="size-4" aria-hidden="true" />
                  {item.label}
                </button>
              );
            })}
          </nav>
        </aside>

        <div className="min-w-0 flex-1">
          <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur lg:px-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold text-teal-700">MVP محلي جاهز للتوصيل بسوبابيس وفيرسل</p>
                <h2 className="mt-1 text-2xl font-black">{activeTitle}</h2>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button type="button" onClick={() => setView("ai")} className="primary-button">
                  <Sparkles className="size-4" aria-hidden="true" />
                  إدخال AI
                </button>
                <button type="button" onClick={() => setView("admin")} className="secondary-button">
                  <ShieldCheck className="size-4" aria-hidden="true" />
                  الملف الشخصي
                  {unreadNotifications > 0 ? <span className="rounded-full bg-amber-400 px-2 py-0.5 text-xs text-slate-950">{unreadNotifications}</span> : null}
                </button>
              </div>
            </div>
            <div className="mt-3 flex gap-2 overflow-x-auto pb-1 lg:hidden">
              {navItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setView(item.id)}
                  className={[
                    "h-10 shrink-0 rounded-md px-3 text-sm font-bold",
                    view === item.id ? "bg-teal-700 text-white" : "bg-slate-100 text-slate-700",
                  ].join(" ")}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </header>
          <div className="p-4 lg:p-6">{renderContent()}</div>
        </div>
      </div>
    </main>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="mb-4 text-lg font-black text-slate-950">{title}</h2>
      {children}
    </section>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center font-bold text-slate-500">
      {label}
    </div>
  );
}

function Info({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
      <p className="text-xs font-bold text-slate-500">{label}</p>
      <p className="mt-1 font-black text-slate-950">{value}</p>
    </div>
  );
}

function ReadinessRow({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className="mb-2 flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50 p-3 text-sm font-bold">
      {ok ? <CheckCircle2 className="size-5 text-teal-700" aria-hidden="true" /> : <XCircle className="size-5 text-amber-600" aria-hidden="true" />}
      <span className="text-slate-800">{label}</span>
    </div>
  );
}
