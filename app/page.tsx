"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Bell,
  Building2,
  Calculator,
  CalendarClock,
  Camera,
  CheckCircle2,
  CircleDollarSign,
  ClipboardCopy,
  Eye,
  History,
  Image as ImageIcon,
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
  UploadCloud,
  UserPlus,
  Users,
  WandSparkles,
  X,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { LocationPicker } from "@/components/LocationPicker";
import { RealEstateMap } from "@/components/RealEstateMap";
import { filterMapRecords, type MapRecord } from "@/lib/map-records";
import { formatArea, parseOptionalPositiveDecimal, parseOptionalPositiveInteger } from "@/lib/number-utils";
import { type PropertyData } from "@/lib/property-schema";

type ViewId =
  | "dashboard"
  | "offers"
  | "requests"
  | "ai"
  | "map"
  | "clients"
  | "admin";

type ProfileSection = "settings" | "reminders" | "notifications" | "sharing" | "trash";
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
  defaultReminderDays: number;
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
  askingPrice: number | null;
  budget: number | null;
  category: string;
  propertyAge: string;
  basePriceMode: "limit" | "asking";
  streetWidth: number | null;
  facade: string;
  facades: string[];
  lengths: string;
  planNumber: string;
  blockNumber: string;
  plotNumber: string;
  bedrooms: number | null;
  bathrooms: number | null;
  clientId: string;
  ownerName: string;
  ownerPhone: string;
  falLicense: string;
  contact: string;
  license: string;
  reminderDays: number;
  notes: string;
  tags: string[];
  images: PropertyImage[];
  source: "manual" | "ai-text" | "ai-voice";
  lat: number | null;
  lng: number | null;
  createdAt: string;
  updatedAt: string;
  sharedAt: string | null;
  deletedAt: string | null;
};

type PropertyImage = {
  id: string;
  url: string;
  name: string;
  main: boolean;
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

type ActivityEvent = {
  id: string;
  type: "record_created" | "record_updated" | "share_sent" | "reminder_created" | "client_created";
  title: string;
  details: string;
  recordId: string | null;
  clientId: string | null;
  createdAt: string;
};

type WorkspaceState = {
  profile: BrokerProfile;
  records: PropertyRecord[];
  clients: ClientRecord[];
  reminders: Reminder[];
  notifications: NotificationItem[];
  activities: ActivityEvent[];
};

type FilterState = {
  query: string;
  status: "all" | RecordStatus;
  city: string;
};

type AuthUser = {
  id: string;
  email: string;
  username: string;
  phone: string;
  name: string;
  role: "admin" | "broker";
  timezone: string;
  falLicense: string;
  emailConfirmed: boolean;
};

type PublicShareLink = {
  id: string;
  record_id: string;
  title: string;
  expires_at: string | null;
  revoked_at: string | null;
  created_at: string;
};

type PublicShareOptions = {
  includePrice: boolean;
  includeAskingPrice: boolean;
  includeArea: boolean;
  includeContact: boolean;
  includeNotes: boolean;
  includeMap: boolean;
  expiresInDays: number | null;
};

const riyadhTimezone = "Asia/Riyadh";

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
    name: "وسيط عقاري",
    role: "broker",
    timezone: riyadhTimezone,
    inviteOnly: false,
    smtpReady: false,
    defaultReminderDays: 14,
  },
  clients: [],
  records: [],
  reminders: [],
  notifications: [],
  activities: [],
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

function optionalPositiveNumber(value: FormDataEntryValue | string | null | undefined) {
  return parseOptionalPositiveDecimal(value);
}

function optionalInteger(value: FormDataEntryValue | string | null | undefined) {
  return parseOptionalPositiveInteger(value);
}

function recordAmount(record: PropertyRecord) {
  return record.kind === "offer" ? record.price : record.budget;
}

function recordBasePrice(record: PropertyRecord) {
  if (record.kind !== "offer") {
    return record.budget;
  }

  return record.basePriceMode === "asking" && record.askingPrice ? record.askingPrice : record.price;
}

function recordPricePerMeter(record: PropertyRecord) {
  const basePrice = recordBasePrice(record);
  return basePrice && record.area ? basePrice / record.area : null;
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
    profile: {
      ...seedState.profile,
      ...state.profile,
      timezone: state.profile?.timezone || riyadhTimezone,
      inviteOnly: false,
      defaultReminderDays: Number(state.profile?.defaultReminderDays) > 0 ? Number(state.profile.defaultReminderDays) : 14,
    },
    records: state.records.map((record) => ({
      ...record,
      status: normalizeRecordStatus(record.kind, String(record.status), record.transaction),
      askingPrice: record.askingPrice ?? null,
      category: record.category ?? "",
      propertyAge: record.propertyAge ?? "",
      basePriceMode: record.basePriceMode === "asking" ? "asking" : "limit",
      facades: Array.isArray(record.facades) ? record.facades : record.facade ? [record.facade] : [],
      lengths: record.lengths ?? "",
      planNumber: record.planNumber ?? "",
      blockNumber: record.blockNumber ?? "",
      plotNumber: record.plotNumber ?? "",
      ownerName: record.ownerName ?? "",
      ownerPhone: record.ownerPhone ?? record.contact ?? "",
      falLicense: record.falLicense ?? "",
      reminderDays: Number(record.reminderDays) > 0 ? Number(record.reminderDays) : 14,
      images: Array.isArray(record.images) ? record.images : [],
    })),
    clients: Array.isArray(state.clients) ? state.clients : [],
    reminders: Array.isArray(state.reminders) ? state.reminders : [],
    notifications: Array.isArray(state.notifications) ? state.notifications : [],
    activities: Array.isArray(state.activities) ? state.activities : [],
  };
}

function recordShareText(record: PropertyRecord, options?: Partial<PublicShareOptions>) {
  const amount = recordAmount(record);
  const includePrice = options?.includePrice ?? true;
  const includeAskingPrice = options?.includeAskingPrice ?? true;
  const includeArea = options?.includeArea ?? true;
  const includeContact = options?.includeContact ?? true;
  const includeNotes = options?.includeNotes ?? false;
  const includeMap = options?.includeMap ?? true;
  return [
    `${recordKindLabels[record.kind]}: ${record.title}`,
    `الحالة: ${statusLabels[record.status]}`,
    `الموقع: ${record.city} - ${record.district}`,
    `النوع: ${record.propertyType} | العملية: ${record.transaction}`,
    includePrice && amount ? `القيمة: ${formatMoney(amount)}` : null,
    includeAskingPrice && record.kind === "offer" && record.askingPrice ? `السوم: ${formatMoney(record.askingPrice)}` : null,
    includeArea && record.area ? `المساحة: ${record.area} م²` : null,
    includeContact && record.contact ? `التواصل: ${record.contact}` : null,
    includeNotes && record.notes ? `ملاحظات: ${record.notes}` : null,
    includeMap && hasUsableCoordinates(record.lat ?? NaN, record.lng ?? NaN) ? `الموقع على الخريطة: https://www.google.com/maps/search/?api=1&query=${record.lat},${record.lng}` : null,
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
    askingPrice: null,
    budget: data.maximumBudget,
    category: "",
    propertyAge: "",
    basePriceMode: "limit",
    streetWidth: data.streetWidth,
    facade: data.facade ?? "",
    facades: data.facade ? [data.facade] : [],
    lengths: "",
    planNumber: "",
    blockNumber: "",
    plotNumber: "",
    bedrooms: data.bedrooms ?? data.minimumBedrooms,
    bathrooms: data.bathrooms,
    clientId,
    ownerName: "",
    ownerPhone: data.contactNumber ?? "",
    falLicense: "",
    contact: data.contactNumber ?? "",
    license: data.licenseNumber ?? "",
    reminderDays: 14,
    notes: data.description ?? "",
    tags: data.missingFields.length > 0 ? ["يحتاج مراجعة"] : ["مدخل AI"],
    images: [],
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
    teal: "border-emerald-400/30 bg-emerald-400/10 text-emerald-50",
    blue: "border-violet-400/30 bg-violet-500/10 text-violet-50",
    amber: "border-[#c9972f]/35 bg-[#c9972f]/10 text-[#e5bc55]",
    slate: "border-slate-500/25 bg-[#0f1f3d] text-slate-50",
  };

  return `rounded-2xl border p-4 card-glow transition hover:-translate-y-0.5 ${tones[tone]}`;
}

function fieldClass() {
  return "h-11 w-full rounded-xl border border-slate-600/40 bg-[#0a1730]/70 px-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-[#c9972f]/70 focus:ring-2 focus:ring-[#c9972f]/15";
}

function hasUsableCoordinates(latitude: number, longitude: number) {
  return Number.isFinite(latitude) && latitude >= -90 && latitude <= 90 && Number.isFinite(longitude) && longitude >= -180 && longitude <= 180;
}

export default function Home() {
  const [workspace, setWorkspace] = useState<WorkspaceState>(seedState);
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
  const [editingRecordId, setEditingRecordId] = useState<string | null>(null);
  const [profileSection, setProfileSection] = useState<ProfileSection>("settings");
  const [selectedShareId, setSelectedShareId] = useState("");
  const [hoveredMapId, setHoveredMapId] = useState<string | null>(null);
  const [isMobileMapOpen, setIsMobileMapOpen] = useState(false);
  const [recordFormVersion, setRecordFormVersion] = useState(0);
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [quickEntryMode, setQuickEntryMode] = useState<"manual" | "whatsapp" | "voice">("manual");
  const [quickKind, setQuickKind] = useState<RecordKind>("offer");
  const [quickLimitPrice, setQuickLimitPrice] = useState("");
  const [quickAskingPrice, setQuickAskingPrice] = useState("");
  const [quickArea, setQuickArea] = useState("");
  const [quickBasePriceMode, setQuickBasePriceMode] = useState<"limit" | "asking">("limit");
  const [quickFacades, setQuickFacades] = useState<string[]>([]);
  const [quickImages, setQuickImages] = useState<PropertyImage[]>([]);
  const [expandedClientId, setExpandedClientId] = useState<string | null>(null);
  const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [aiProgress, setAiProgress] = useState("");
  const [clockNow, setClockNow] = useState(0);
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authPasswordConfirm, setAuthPasswordConfirm] = useState("");
  const [authIdentifier, setAuthIdentifier] = useState("");
  const [authName, setAuthName] = useState("");
  const [authPhone, setAuthPhone] = useState("");
  const [authFalLicense, setAuthFalLicense] = useState("");
  const [authOtp, setAuthOtp] = useState("");
  const [authNewPassword, setAuthNewPassword] = useState("");
  const [authMode, setAuthMode] = useState<"login" | "register" | "confirm" | "forgot" | "reset">("login");
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [authMessage, setAuthMessage] = useState<string | null>(null);
  const [publicShareUrl, setPublicShareUrl] = useState("");
  const [publicShareMessage, setPublicShareMessage] = useState<string | null>(null);
  const [publicShareBusy, setPublicShareBusy] = useState(false);
  const [publicShareLinks, setPublicShareLinks] = useState<PublicShareLink[]>([]);
  const [publicShareOptions, setPublicShareOptions] = useState<PublicShareOptions>({
    includePrice: true,
    includeAskingPrice: true,
    includeArea: true,
    includeContact: false,
    includeNotes: false,
    includeMap: true,
    expiresInDays: 30,
  });
  const [cloudStatus, setCloudStatus] = useState<"local" | "checking" | "synced" | "blocked" | "error">("checking");
  const cloudLoadedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    async function loadSession() {
      try {
        const response = await fetch("/api/auth/session", { cache: "no-store" });
        const body = (await response.json()) as { user: AuthUser | null };
        if (cancelled) {
          return;
        }
        setAuthUser(body.user);
        setCloudStatus(body.user ? "checking" : "local");
      } catch {
        if (!cancelled) {
          setCloudStatus("error");
          setAuthMessage("تعذر الاتصال بخدمة الدخول.");
        }
      } finally {
        if (!cancelled) {
          setAuthReady(true);
        }
      }
    }

    void loadSession();

    return () => {
      cancelled = true;
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
    const updateClock = () => setClockNow(Date.now());
    updateClock();
    const timer = window.setInterval(updateClock, 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!authUser || !authReady || cloudLoadedRef.current) {
      return;
    }

    const activeUser = authUser;
    let cancelled = false;

    async function loadCloudWorkspace() {
      setCloudStatus("checking");
      const response = await fetch("/api/workspace", { cache: "no-store" });
      const body = (await response.json()) as { state: WorkspaceState | null; user: AuthUser; error?: string };
      if (cancelled) {
        return;
      }

      if (!response.ok) {
        setCloudStatus("error");
        setAuthMessage(body.error ?? "تعذر تحميل بيانات الحساب. تواصل مع الإدارة إذا تكرر الخطأ.");
        return;
      }

      const profile = body.user ?? activeUser;
      if (body.state && typeof body.state === "object") {
        const cloudWorkspace = normalizeWorkspaceState(body.state);
        setWorkspace({
          ...cloudWorkspace,
          profile: {
            ...cloudWorkspace.profile,
            id: profile.id,
            name: profile.name || "وسيط عقاري",
            role: profile.role === "admin" ? "admin" : "broker",
            timezone: profile.timezone || riyadhTimezone,
            inviteOnly: false,
            smtpReady: true,
          },
        });
        setSelectedShareId(cloudWorkspace.records.find((record) => !record.deletedAt)?.id ?? "");
      } else {
        setWorkspace({
          ...seedState,
          profile: {
            ...seedState.profile,
            id: profile.id,
            name: profile.name || "وسيط عقاري",
            role: profile.role === "admin" ? "admin" : "broker",
            timezone: profile.timezone || riyadhTimezone,
            inviteOnly: false,
            smtpReady: true,
          },
        });
        setSelectedShareId("");
      }

      cloudLoadedRef.current = true;
      setCloudStatus("synced");
      setAuthMessage("تم الاتصال بقاعدة البيانات وحفظ البيانات سحابياً لهذا الحساب.");
    }

    void loadCloudWorkspace();

    return () => {
      cancelled = true;
    };
  }, [authReady, authUser]);

  useEffect(() => {
    if (!authUser || !cloudLoadedRef.current || cloudStatus === "blocked") {
      return;
    }

    const timer = window.setTimeout(() => {
      fetch("/api/workspace", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ state: workspace, version: 1 }),
      })
        .then((response) => {
          if (!response.ok) {
            setCloudStatus("error");
            setAuthMessage("تعذر حفظ آخر تغيير في قاعدة البيانات.");
            return;
          }
          setCloudStatus("synced");
        });
    }, 700);

    return () => window.clearTimeout(timer);
  }, [authUser, cloudStatus, workspace]);

  const activeRecords = useMemo(() => workspace.records.filter((record) => !record.deletedAt), [workspace.records]);
  const trashedRecords = useMemo(() => workspace.records.filter((record) => record.deletedAt), [workspace.records]);
  const offers = useMemo(() => activeRecords.filter((record) => record.kind === "offer"), [activeRecords]);
  const requests = useMemo(() => activeRecords.filter((record) => record.kind === "request"), [activeRecords]);
  const cities = useMemo(() => Array.from(new Set(activeRecords.map((record) => record.city))).filter(Boolean), [activeRecords]);
  const unreadNotifications = workspace.notifications.filter((notification) => !notification.read).length;
  const dueReminders = workspace.reminders.filter(
    (reminder) => reminder.status === "due" || (reminder.status === "scheduled" && clockNow > 0 && new Date(reminder.dueAt).getTime() <= clockNow),
  ).length;
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
    const record = activeRecords.find((item) => item.id === recordId);
    if (record) {
      setView(record.kind === "offer" ? "offers" : "requests");
      setSelectedRecordId(recordId);
    }
    window.setTimeout(() => {
      document.getElementById(`record-${recordId}`)?.scrollIntoView({ block: "center", behavior: "smooth" });
    }, 30);
  }

  function requireAuthenticatedAction() {
    if (authUser && cloudStatus !== "blocked") {
      return true;
    }

    setView("admin");
    setProfileSection("settings");
    setAuthMessage("سجل الدخول أولاً للوصول إلى بياناتك وتنفيذ هذا الإجراء.");
    return false;
  }

  function updateRecord(recordId: string, patch: Partial<PropertyRecord>) {
    if (!requireAuthenticatedAction()) {
      return;
    }

    setWorkspace((current) => {
      const record = current.records.find((item) => item.id === recordId);
      const updatedAt = nowIso();
      return {
        ...current,
        records: current.records.map((item) => (item.id === recordId ? { ...item, ...patch, updatedAt } : item)),
        activities: record
          ? [
              {
                id: makeId("activity"),
                type: "record_updated" as const,
                title: "تحديث سجل عقاري",
                details: record.title,
                recordId,
                clientId: record.clientId || null,
                createdAt: updatedAt,
              },
              ...current.activities,
            ].slice(0, 200)
          : current.activities,
      };
    });
  }

  function updateRecordFromForm(recordId: string, formData: FormData) {
    const priceValue = optionalPositiveNumber(formData.get("price"));
    const askingPriceValue = optionalPositiveNumber(formData.get("askingPrice"));
    const areaValue = optionalPositiveNumber(formData.get("area"));
    const latitudeValue = Number(formData.get("latitude") || Number.NaN);
    const longitudeValue = Number(formData.get("longitude") || Number.NaN);
    const hasCoordinates = hasUsableCoordinates(latitudeValue, longitudeValue);
    const record = activeRecords.find((item) => item.id === recordId);
    const kind = record?.kind ?? "offer";

    updateRecord(recordId, {
      title: String(formData.get("title") || record?.title || "").trim() || record?.title,
      propertyType: String(formData.get("propertyType") || record?.propertyType || "غير محدد"),
      transaction: String(formData.get("transaction") || record?.transaction || "غير محدد"),
      city: String(formData.get("city") || record?.city || "الرياض"),
      district: String(formData.get("district") || record?.district || "غير محدد"),
      area: areaValue,
      price: kind === "offer" ? priceValue : null,
      askingPrice: kind === "offer" ? askingPriceValue : null,
      budget: kind === "request" ? priceValue : null,
      category: String(formData.get("category") || ""),
      propertyAge: String(formData.get("propertyAge") || ""),
      basePriceMode: formData.get("basePriceMode") === "asking" ? "asking" : "limit",
      streetWidth: optionalPositiveNumber(formData.get("streetWidth")),
      facade: formData.getAll("facades").map(String).join("، ") || String(formData.get("facade") || ""),
      facades: formData.getAll("facades").map(String),
      lengths: String(formData.get("lengths") || ""),
      planNumber: String(formData.get("planNumber") || ""),
      blockNumber: String(formData.get("blockNumber") || ""),
      plotNumber: String(formData.get("plotNumber") || ""),
      bedrooms: optionalInteger(formData.get("bedrooms")),
      bathrooms: optionalInteger(formData.get("bathrooms")),
      contact: String(formData.get("contact") || ""),
      ownerName: String(formData.get("ownerName") || ""),
      ownerPhone: String(formData.get("ownerPhone") || formData.get("contact") || ""),
      falLicense: String(formData.get("falLicense") || authUser?.falLicense || ""),
      license: String(formData.get("license") || ""),
      reminderDays: Number(formData.get("reminderDays") || record?.reminderDays || workspace.profile.defaultReminderDays),
      notes: String(formData.get("notes") || ""),
      lat: hasCoordinates ? latitudeValue : null,
      lng: hasCoordinates ? longitudeValue : null,
    });
    setEditingRecordId(null);
  }

  function addNotification(title: string, body: string, level: NotificationLevel = "info") {
    if (!authUser || cloudStatus === "blocked") {
      return;
    }

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

  async function requestPasswordReset(formData: FormData) {
    const email = String(formData.get("email") ?? authEmail).trim().toLowerCase();
    if (!email) {
      setAuthMessage("أدخل البريد الإلكتروني أولاً.");
      return;
    }

    setAuthEmail(email);
    setAuthMessage("جاري إرسال رمز استعادة كلمة المرور...");
    const response = await fetch("/api/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const body = (await readJsonResponse<{ message?: string }>(response)) as { message?: string; error?: string };

    if (response.ok) {
      setAuthMode("reset");
      setAuthMessage(body.message ?? "إذا كان البريد مسجلاً، سيصلك رمز OTP.");
      return;
    }

    setAuthMessage(body.error ?? "تعذر إرسال رمز الاستعادة.");
  }

  async function registerWithEmail(formData: FormData) {
    const email = String(formData.get("email") ?? authEmail).trim().toLowerCase();
    const password = String(formData.get("password") ?? authPassword);
    const passwordConfirm = String(formData.get("passwordConfirm") ?? authPasswordConfirm);
    const name = String(formData.get("name") ?? authName).trim();
    const phone = String(formData.get("phone") ?? authPhone).trim();
    const falLicense = String(formData.get("falLicense") ?? authFalLicense).trim();
    if (!name || !phone || !email || password.length < 8) {
      setAuthMessage("أدخل اسم الوسيط والجوال والبريد وكلمة مرور لا تقل عن 8 أحرف.");
      return;
    }
    if (password !== passwordConfirm) {
      setAuthMessage("كلمة المرور وتأكيدها غير متطابقين.");
      return;
    }

    setAuthEmail(email);
    setAuthPassword(password);
    setAuthPasswordConfirm(passwordConfirm);
    setAuthName(name);
    setAuthPhone(phone);
    setAuthFalLicense(falLicense);
    setAuthMessage("جاري إنشاء الحساب وإرسال رمز OTP...");

    const response = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, name, phone, falLicense }),
    });
    const body = (await readJsonResponse<{ user: AuthUser | null; message?: string }>(response)) as {
      user: AuthUser | null;
      message?: string;
      error?: string;
    };

    if (!response.ok) {
      setAuthMessage(body.error ?? "تعذر إنشاء الحساب. تحقق من البريد أو قوة كلمة المرور.");
      return;
    }

    setAuthMode("confirm");
    setAuthMessage(body.message ?? "تم إنشاء الحساب.");
  }

  async function confirmEmailOtp(formData: FormData) {
    const email = String(formData.get("email") ?? authEmail).trim().toLowerCase();
    const code = String(formData.get("code") ?? authOtp).trim();
    if (!email || !/^\d{6}$/.test(code)) {
      setAuthMessage("أدخل البريد ورمز OTP المكون من 6 أرقام.");
      return;
    }

    setAuthEmail(email);
    setAuthOtp(code);
    setAuthMessage("جاري تفعيل الحساب...");
    const response = await fetch("/api/auth/confirm-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, code }),
    });
    const body = (await readJsonResponse<{ user: AuthUser; message?: string }>(response)) as { user?: AuthUser; message?: string; error?: string };
    if (!response.ok || !body.user) {
      setAuthMessage(body.error ?? "تعذر تفعيل الحساب.");
      return;
    }

    setAuthUser(body.user);
    setWorkspace(seedState);
    setSelectedShareId("");
    cloudLoadedRef.current = false;
    setCloudStatus("checking");
    setAuthMessage(body.message ?? "تم تفعيل الحساب.");
  }

  async function resendConfirmationOtp() {
    const email = authEmail.trim().toLowerCase();
    if (!email) {
      setAuthMessage("أدخل البريد الإلكتروني أولاً.");
      return;
    }

    const response = await fetch("/api/auth/resend-confirmation", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const body = (await readJsonResponse<{ message?: string }>(response)) as { message?: string; error?: string };
    setAuthMessage(response.ok ? body.message ?? "تم إرسال رمز جديد." : body.error ?? "تعذر إرسال رمز جديد.");
  }

  async function signInWithEmail(formData: FormData) {
    const identifier = String(formData.get("identifier") ?? authIdentifier).trim();
    const password = String(formData.get("password") ?? authPassword);
    if (!identifier || !password) {
      setAuthMessage("أدخل رقم الجوال أو البريد مع كلمة المرور.");
      return;
    }

    setAuthIdentifier(identifier);
    setAuthPassword(password);
    setAuthMessage("جاري تسجيل الدخول...");
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identifier, password }),
    });
    const body = (await readJsonResponse<{ user: AuthUser; message?: string }>(response)) as { user?: AuthUser; message?: string; error?: string };
    if (!response.ok || !body.user) {
      setAuthMessage(body.error ?? "تعذر تسجيل الدخول. تأكد من البريد وكلمة المرور.");
      return;
    }

    setAuthUser(body.user);
    setWorkspace(seedState);
    setSelectedShareId("");
    cloudLoadedRef.current = false;
    setCloudStatus("checking");
    setAuthMessage(body.message ?? "تم تسجيل الدخول بنجاح.");
  }

  async function resetPasswordWithOtp(formData: FormData) {
    const email = String(formData.get("email") ?? authEmail).trim().toLowerCase();
    const code = String(formData.get("code") ?? authOtp).trim();
    const password = String(formData.get("password") ?? authNewPassword);
    if (!email || !/^\d{6}$/.test(code) || password.length < 8) {
      setAuthMessage("أدخل البريد ورمز OTP وكلمة مرور جديدة لا تقل عن 8 أحرف.");
      return;
    }

    const response = await fetch("/api/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, code, password }),
    });
    const body = (await readJsonResponse<{ message?: string }>(response)) as { message?: string; error?: string };
    if (!response.ok) {
      setAuthMessage(body.error ?? "تعذر تغيير كلمة المرور.");
      return;
    }

    const sessionResponse = await fetch("/api/auth/session", { cache: "no-store" });
    const sessionBody = (await readJsonResponse<{ user: AuthUser | null }>(sessionResponse)) as { user?: AuthUser | null };
    if (sessionBody.user) {
      setAuthUser(sessionBody.user);
      setWorkspace(seedState);
      setSelectedShareId("");
      cloudLoadedRef.current = false;
      setCloudStatus("checking");
    }
    setAuthMessage(body.message ?? "تم تغيير كلمة المرور وتسجيل الدخول.");
  }

  async function signOut() {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    setAuthUser(null);
    setWorkspace(seedState);
    setSelectedShareId("");
    setPublicShareUrl("");
    setPublicShareLinks([]);
    setCloudStatus("local");
    cloudLoadedRef.current = false;
    setAuthMessage("تم تسجيل الخروج.");
  }

  function addRecord(kind: RecordKind, formData: FormData) {
    if (!requireAuthenticatedAction()) {
      return;
    }

    const selectedClientId = String(formData.get("clientId") ?? "");
    const title = String(formData.get("title") ?? "").trim();
    const priceValue = optionalPositiveNumber(formData.get("price"));
    const askingPriceValue = optionalPositiveNumber(formData.get("askingPrice"));
    const areaValue = optionalPositiveNumber(formData.get("area"));
    const latitudeValue = Number(formData.get("latitude") || Number.NaN);
    const longitudeValue = Number(formData.get("longitude") || Number.NaN);
    const hasCoordinates = hasUsableCoordinates(latitudeValue, longitudeValue);
    const requestedStatus = String(formData.get("status") || "");
    const defaultTransaction =
      requestedStatus === "for_rent" || requestedStatus === "rental"
        ? kind === "offer" ? "إيجار" : "استئجار"
        : kind === "offer" ? "بيع" : "شراء";
    const transaction = String(formData.get("transaction") || defaultTransaction);
    const ownerName = String(formData.get("ownerName") || "").trim();
    const ownerPhone = normalizePhone(String(formData.get("ownerPhone") || ""));
    const reminderDays = Number(formData.get("reminderDays") || workspace.profile.defaultReminderDays || 14);
    const existingClient = ownerPhone ? workspace.clients.find((client) => normalizePhone(client.phone) === ownerPhone) : null;
    const generatedClientId = !selectedClientId && !existingClient && ownerName ? makeId("client") : "";
    const clientId = selectedClientId || existingClient?.id || generatedClientId;
    const createdAt = nowIso();
    const record: PropertyRecord = {
      id: makeId("rec"),
      kind,
      title: title || (kind === "offer" ? "عرض جديد" : "طلب جديد"),
      propertyType: String(formData.get("propertyType") || "غير محدد"),
      transaction,
      status: statusOptionsByKind[kind].some((option) => option.value === requestedStatus)
        ? (requestedStatus as RecordStatus)
        : defaultStatusForRecord(kind, transaction),
      city: String(formData.get("city") || "الرياض"),
      district: String(formData.get("district") || "غير محدد"),
      area: areaValue,
      price: kind === "offer" ? priceValue : null,
      askingPrice: kind === "offer" ? askingPriceValue : null,
      budget: kind === "request" ? priceValue : null,
      category: String(formData.get("category") || ""),
      propertyAge: String(formData.get("propertyAge") || ""),
      basePriceMode: formData.get("basePriceMode") === "asking" ? "asking" : "limit",
      streetWidth: optionalPositiveNumber(formData.get("streetWidth")),
      facade: formData.getAll("facades").map(String).join("، "),
      facades: formData.getAll("facades").map(String),
      lengths: String(formData.get("lengths") || ""),
      planNumber: String(formData.get("planNumber") || ""),
      blockNumber: String(formData.get("blockNumber") || ""),
      plotNumber: String(formData.get("plotNumber") || ""),
      bedrooms: null,
      bathrooms: null,
      clientId,
      ownerName,
      ownerPhone,
      falLicense: String(formData.get("falLicense") || authUser?.falLicense || ""),
      contact: ownerPhone || workspace.clients.find((client) => client.id === clientId)?.phone || "",
      license: String(formData.get("license") || ""),
      reminderDays: Number.isFinite(reminderDays) && reminderDays > 0 ? reminderDays : 14,
      notes: String(formData.get("notes") || ""),
      tags: kind === "offer" ? ["عرض يدوي"] : ["طلب يدوي"],
      images: quickImages,
      source: "manual",
      lat: hasCoordinates ? latitudeValue : null,
      lng: hasCoordinates ? longitudeValue : null,
      createdAt,
      updatedAt: createdAt,
      sharedAt: null,
      deletedAt: null,
    };

    const dueAt = new Date(createdAt);
    dueAt.setDate(dueAt.getDate() + record.reminderDays);
    setWorkspace((current) => ({
      ...current,
      records: [record, ...current.records],
      clients: generatedClientId
        ? [
            {
              id: generatedClientId,
              name: ownerName,
              phone: ownerPhone,
              type: kind === "offer" ? "owner" : "buyer",
              priority: "medium",
              notes: `أضيف تلقائياً مع ${recordKindLabels[kind]} ${record.title}`,
              lastContactAt: createdAt,
            },
            ...current.clients,
          ]
        : current.clients,
      reminders: [
        {
          id: makeId("rem"),
          recordId: record.id,
          title: `تحديث ${record.title}`,
          dueAt: dueAt.toISOString(),
          status: "scheduled",
        },
        ...current.reminders,
      ],
      activities: [
        {
          id: makeId("activity"),
          type: "record_created" as const,
          title: `إضافة ${recordKindLabels[kind]} جديد`,
          details: record.title,
          recordId: record.id,
          clientId: clientId || null,
          createdAt,
        },
        ...current.activities,
      ].slice(0, 200),
    }));
    setSelectedShareId(record.id);
    setRecordFormVersion((value) => value + 1);
    setQuickAddOpen(false);
    setQuickLimitPrice("");
    setQuickAskingPrice("");
    setQuickArea("");
    setQuickFacades([]);
    setQuickImages([]);
    setSelectedRecordId(record.id);
    addNotification("تم إنشاء سجل", `تم حفظ ${recordKindLabels[kind]}: ${record.title}`, "success");
  }

  function addClient(formData: FormData) {
    if (!requireAuthenticatedAction()) {
      return;
    }

    const client: ClientRecord = {
      id: makeId("client"),
      name: String(formData.get("name") || "عميل جديد"),
      phone: normalizePhone(String(formData.get("phone") || "")),
      type: String(formData.get("type") || "buyer") as ClientRecord["type"],
      priority: String(formData.get("priority") || "medium") as ClientRecord["priority"],
      notes: String(formData.get("notes") || ""),
      lastContactAt: nowIso(),
    };

    setWorkspace((current) => ({
      ...current,
      clients: [client, ...current.clients],
      activities: [
        {
          id: makeId("activity"),
          type: "client_created" as const,
          title: "إضافة عميل",
          details: client.name,
          recordId: null,
          clientId: client.id,
          createdAt: client.lastContactAt,
        },
        ...current.activities,
      ].slice(0, 200),
    }));
    addNotification("عميل جديد", `تمت إضافة ${client.name} إلى CRM.`, "success");
  }

  function addReminder(recordId: string) {
    if (!requireAuthenticatedAction()) {
      return;
    }

    const record = activeRecords.find((item) => item.id === recordId);
    if (!record) {
      return;
    }

    const dueAt = new Date();
    dueAt.setDate(dueAt.getDate() + record.reminderDays);
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
      activities: [
        {
          id: makeId("activity"),
          type: "reminder_created" as const,
          title: "إنشاء تذكير",
          details: record.title,
          recordId: record.id,
          clientId: record.clientId || null,
          createdAt: nowIso(),
        },
        ...current.activities,
      ].slice(0, 200),
    }));
    addNotification("تم إنشاء تذكير", `موعد المتابعة بعد ${record.reminderDays} يوماً حسب توقيت ${workspace.profile.timezone}.`, "success");
  }

  function filteredActiveRecords(kind?: RecordKind) {
    const query = filters.query.trim().toLowerCase();
    const effectiveStatus =
      kind && filters.status !== "all" && !statusOptionsByKind[kind].some((option) => option.value === filters.status)
        ? "all"
        : filters.status;

    return activeRecords.filter((record) => {
      const clientName = workspace.clients.find((client) => client.id === record.clientId)?.name ?? record.ownerName;
      const matchesKind = kind === undefined || record.kind === kind;
      const matchesStatus = effectiveStatus === "all" || record.status === effectiveStatus;
      const matchesCity = filters.city === "all" || record.city === filters.city;
      const matchesQuery =
        !query ||
        [record.title, record.city, record.district, record.propertyType, record.transaction, record.notes, record.contact, clientName, record.planNumber, record.plotNumber]
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

  function updateAiResult(patch: Partial<PropertyData>) {
    setAiResult((current) => (current ? { ...current, ...patch } : current));
  }

  function resetAiEntry() {
    setAiText("");
    setAiResult(null);
    setAiSource("ai-text");
    setAiError(null);
    setAiProgress("");
  }

  async function analyzeText(value = aiText) {
    if (!requireAuthenticatedAction()) {
      return;
    }

    const cleanText = value.trim();
    if (!cleanText) {
      setAiError("أدخل نصاً عقارياً أولاً.");
      return;
    }

    setAiBusy(true);
    setAiError(null);
    setAiProgress("جاري تحليل الرسالة...");
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 25000);
    try {
      const response = await fetch("/api/extract-property", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: cleanText }),
        signal: controller.signal,
      });
      setAiProgress("جاري تجهيز البيانات...");
      const body = await readJsonResponse<PropertyData>(response);
      if (!response.ok) {
        throw new Error(body.error ?? "فشل تحليل النص.");
      }
      setAiSource("ai-text");
      setAiResult(body);
    } catch (error) {
      setAiError(error instanceof DOMException && error.name === "AbortError" ? "طال تحليل الرسالة. بقي النص محفوظاً ويمكنك إعادة المحاولة." : error instanceof Error ? error.message : "حدث خطأ غير متوقع.");
    } finally {
      window.clearTimeout(timeout);
      setAiProgress("");
      setAiBusy(false);
    }
  }

  async function transcribeAudio(audio: Blob, filename = "recording.webm") {
    if (!requireAuthenticatedAction()) {
      return;
    }

    setAiBusy(true);
    setAiError(null);
    setAiProgress("جاري تحويل الصوت إلى نص...");
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
      setAiProgress("جاري تحليل النص المستخرج...");
      await analyzeText(body.text);
    } catch (error) {
      setAiError(error instanceof Error ? error.message : "حدث خطأ غير متوقع.");
    } finally {
      setAiBusy(false);
    }
  }

  async function uploadPropertyImage(file: File) {
    if (!requireAuthenticatedAction()) {
      return;
    }

    if (!file.type.startsWith("image/")) {
      setAuthMessage("لا يدعم النظام هذا النوع من الملفات. اختر صورة فقط.");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setAuthMessage("حجم الصورة يجب ألا يتجاوز 5MB.");
      return;
    }

    const formData = new FormData();
    formData.append("image", file);
    const response = await fetch("/api/property-images", { method: "POST", body: formData });
    const body = await readJsonResponse<{ image: PropertyImage }>(response);
    if (!response.ok || !body.image) {
      setAuthMessage(body.error ?? "تعذر رفع الصورة.");
      return;
    }

    setQuickImages((current) => [...current, { ...body.image, main: current.length === 0 }]);
    setAuthMessage("تم رفع الصورة وإضافتها إلى المعاينة.");
  }

  async function startAudioRecording() {
    setAiError(null);
    const isLocalHost = ["localhost", "127.0.0.1", "::1"].includes(window.location.hostname);
    if (!window.isSecureContext && !isLocalHost) {
      setAiError("تسجيل الصوت يحتاج HTTPS حتى يسمح المتصفح باستخدام الميكروفون. فعّل SSL للدومين أو جرّبه محلياً على localhost.");
      return;
    }
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
    if (!requireAuthenticatedAction()) {
      return;
    }

    if (!aiResult) {
      return;
    }

    const record = mapAiToRecord(aiResult, aiSource, workspace.clients);
    setWorkspace((current) => ({
      ...current,
      records: [record, ...current.records],
      activities: [
        {
          id: makeId("activity"),
          type: "record_created" as const,
          title: "حفظ إدخال ذكي",
          details: record.title,
          recordId: record.id,
          clientId: record.clientId || null,
          createdAt: record.createdAt,
        },
        ...current.activities,
      ].slice(0, 200),
    }));
    setSelectedShareId(record.id);
    setSelectedRecordId(record.id);
    setQuickAddOpen(false);
    addNotification("تم حفظ إدخال AI", `تم تحويل النص إلى ${recordKindLabels[record.kind]} قابل للمراجعة.`, "success");
    resetAiEntry();
  }

  function markShared(recordId: string) {
    if (!requireAuthenticatedAction()) {
      return;
    }

    const record = activeRecords.find((item) => item.id === recordId);
    updateRecord(recordId, { sharedAt: nowIso() });
    if (record) {
      setWorkspace((current) => ({
        ...current,
        activities: [
          {
            id: makeId("activity"),
            type: "share_sent" as const,
            title: "مشاركة سجل عقاري",
            details: record.title,
            recordId: record.id,
            clientId: record.clientId || null,
            createdAt: nowIso(),
          },
          ...current.activities,
        ].slice(0, 200),
      }));
    }
    addNotification("تم تجهيز مشاركة", record ? `تم تسجيل مشاركة ${record.title}.` : "تم تسجيل المشاركة.", "success");
  }

  async function loadPublicShareLinks() {
    if (!authUser) {
      return;
    }

    const response = await fetch("/api/shares", { cache: "no-store" });
    const body = (await readJsonResponse<{ shares: PublicShareLink[] }>(response)) as { shares?: PublicShareLink[]; error?: string };
    if (!response.ok) {
      setPublicShareMessage(body.error ?? "تعذر تحميل روابط المشاركة.");
      return;
    }

    setPublicShareLinks(body.shares ?? []);
  }

  async function createPublicShareLink() {
    if (!requireAuthenticatedAction() || !selectedShareRecord) {
      return;
    }

    setPublicShareBusy(true);
    setPublicShareMessage("جاري إنشاء رابط المشاركة...");
    try {
      const response = await fetch("/api/shares", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ record: selectedShareRecord, options: publicShareOptions }),
      });
      const body = (await readJsonResponse<{ url: string; share: PublicShareLink }>(response)) as {
        url?: string;
        share?: PublicShareLink;
        error?: string;
      };
      if (!response.ok || !body.url || !body.share) {
        throw new Error(body.error ?? "تعذر إنشاء رابط المشاركة.");
      }

      setPublicShareUrl(body.url);
      setPublicShareLinks((current) => [body.share as PublicShareLink, ...current]);
      markShared(selectedShareRecord.id);
      setPublicShareMessage("تم إنشاء رابط عام آمن لهذا السجل.");
    } catch (error) {
      setPublicShareMessage(error instanceof Error ? error.message : "تعذر إنشاء رابط المشاركة.");
    } finally {
      setPublicShareBusy(false);
    }
  }

  function updatePublicShareOptions(patch: Partial<PublicShareOptions>) {
    setPublicShareOptions((current) => ({ ...current, ...patch }));
    setPublicShareUrl("");
    setPublicShareMessage("تم تحديث خيارات المشاركة. أنشئ رابطاً جديداً لتطبيقها على الرابط العام.");
  }

  async function revokePublicShareLink(id: string) {
    const response = await fetch(`/api/shares/${id}`, { method: "PATCH" });
    const body = (await readJsonResponse<{ share: PublicShareLink }>(response)) as { share?: PublicShareLink; error?: string };
    if (!response.ok || !body.share) {
      setPublicShareMessage(body.error ?? "تعذر إلغاء الرابط.");
      return;
    }

    setPublicShareLinks((current) => current.map((item) => (item.id === id ? (body.share as PublicShareLink) : item)));
    setPublicShareMessage("تم إلغاء الرابط.");
  }

  function renderMetric(label: string, value: string | number, tone: "teal" | "blue" | "amber" | "slate", icon: LucideIcon) {
    const Icon = icon;
    return (
      <div className={metricClass(tone)}>
        <div className="mb-3 flex size-10 items-center justify-center rounded-xl border border-current/25 bg-current/10">
          <Icon className="size-5" aria-hidden="true" />
        </div>
        <p className="text-2xl font-extrabold text-white nums-latin">{value}</p>
        <p className="mt-0.5 text-xs font-semibold text-slate-400">{label}</p>
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
    const costs = calculateOfferCosts(recordBasePrice(record));

    return (
      <div className="mt-4 rounded-2xl border border-[#c9972f]/30 navy-gradient p-4 card-glow">
        <div className="mb-3 flex items-center gap-2 text-[#e5bc55]">
          <Calculator className="size-4" aria-hidden="true" />
          <p className="font-black">التفاصيل المالية للعرض</p>
        </div>
        <div className="grid gap-2 text-sm font-bold text-slate-200 sm:grid-cols-2">
          <span>السعر الأساسي ({record.basePriceMode === "asking" ? "السوم" : "الحد"}): {formatMoney(costs.basePrice)}</span>
          <span>ضريبة التصرفات 5%: {formatMoney(costs.rett)}</span>
          <span>عمولة الوساطة 2.5%: {formatMoney(costs.commission)}</span>
          <span>VAT على العمولة 15%: {formatMoney(costs.vatOnCommission)}</span>
        </div>
        <p className="mt-3 rounded-xl border border-[#c9972f]/20 bg-[#0a1730]/70 p-3 text-lg font-black text-[#e5bc55]">الإجمالي التقديري: {formatMoney(costs.total)}</p>
      </div>
    );
  }

  function renderRecordCard(record: PropertyRecord) {
    const client = workspace.clients.find((item) => item.id === record.clientId);
    const pricePerMeter = recordPricePerMeter(record);
    const mainImage = record.images.find((image) => image.main) ?? record.images[0] ?? null;
    const cardTone =
      record.status === "archived"
        ? "border-slate-600/35"
        : record.status === "sold_or_rented" || record.status === "fulfilled"
          ? "border-emerald-400/35"
          : record.kind === "offer"
            ? "border-amber-300/35"
            : "border-sky-400/35";
    return (
      <article
        key={record.id}
        id={`record-${record.id}`}
        onClick={() => setSelectedRecordId(record.id)}
        className={`relative cursor-pointer overflow-hidden rounded-2xl border bg-[#0f1f3d] p-4 card-glow transition hover:-translate-y-0.5 hover:border-[#c9972f]/45 ${cardTone}`}
      >
        <div className="pointer-events-none absolute inset-x-0 top-0 h-1 gold-gradient opacity-80" />
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 flex-1 gap-3">
            {mainImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={mainImage.url} alt={record.title} className="h-20 w-24 shrink-0 rounded-xl border border-slate-600/40 object-cover" />
            ) : null}
            <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-slate-500/30 bg-[#172641]/80 px-3 py-1 text-xs font-bold text-slate-200">
                {recordKindLabels[record.kind]}
              </span>
              <span className="rounded-full border border-[#c9972f]/35 bg-[#c9972f]/15 px-3 py-1 text-xs font-bold text-[#e5bc55]">
                {statusLabels[record.status]}
              </span>
            </div>
            <h3 className="mt-3 line-clamp-1 text-lg font-extrabold text-white">{record.title}</h3>
            <p className="mt-1 text-sm text-slate-400">
              {record.city}، {record.district} | {record.propertyType} | {record.transaction}
            </p>
            </div>
          </div>
          <p className="rounded-xl border border-[#c9972f]/30 bg-[#c9972f]/10 px-4 py-3 text-lg font-extrabold text-[#e5bc55] nums-latin">{formatMoney(recordAmount(record))}</p>
        </div>
        <div className="mt-4 grid gap-2 text-sm text-slate-300 sm:grid-cols-2 xl:grid-cols-4">
          <span className="rounded-xl border border-slate-600/35 bg-[#172641]/45 p-2">المساحة: {formatArea(record.area)}</span>
          <span className="rounded-xl border border-slate-600/35 bg-[#172641]/45 p-2">السوم: {formatMoney(record.askingPrice)}</span>
          <span className="rounded-xl border border-slate-600/35 bg-[#172641]/45 p-2">سعر المتر: {pricePerMeter ? formatMoney(pricePerMeter) : "غير محدد"}</span>
          <span className="rounded-xl border border-slate-600/35 bg-[#172641]/45 p-2">الواجهة: {record.facades.join("، ") || record.facade || "غير محدد"}</span>
          <span className="rounded-xl border border-slate-600/35 bg-[#172641]/45 p-2">الشارع: {record.streetWidth ? `${record.streetWidth} م` : "غير محدد"}</span>
          <span className="rounded-xl border border-slate-600/35 bg-[#172641]/45 p-2">المخطط: {record.planNumber || "غير محدد"}</span>
          <span className="rounded-xl border border-slate-600/35 bg-[#172641]/45 p-2">العمر: {record.propertyAge || "غير محدد"}</span>
          <span className="rounded-xl border border-slate-600/35 bg-[#172641]/45 p-2">العميل: {client?.name ?? "غير مرتبط"}</span>
        </div>
        <p className="mt-3 line-clamp-2 text-sm leading-7 text-slate-300">{record.notes || "لا توجد ملاحظات."}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" onClick={(event) => { event.stopPropagation(); addReminder(record.id); }} className="action-button">
            <CalendarClock className="size-4" aria-hidden="true" />
            تذكير
          </button>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              setSelectedShareId(record.id);
              setShareModalOpen(true);
            }}
            className="action-button"
          >
            <Share2 className="size-4" aria-hidden="true" />
            مشاركة
          </button>
          <button
            type="button"
            onClick={(event) => { event.stopPropagation(); setEditingRecordId((current) => (current === record.id ? null : record.id)); }}
            className="action-button"
          >
            <WandSparkles className="size-4" aria-hidden="true" />
            تعديل
          </button>
          <button type="button" onClick={(event) => { event.stopPropagation(); setSelectedRecordId(record.id); }} className="action-button">
            <Eye className="size-4" aria-hidden="true" />
            عرض التفاصيل
          </button>
          {record.kind === "offer" && view === "offers" ? (
            <button
            type="button"
            onClick={(event) => { event.stopPropagation(); setExpandedCalculatorRecordId((current) => (current === record.id ? null : record.id)); }}
              className="action-button border-amber-300/35 bg-amber-300/10 text-amber-100 hover:border-amber-300/60"
            >
              <Calculator className="size-4" aria-hidden="true" />
              الحاسبة
            </button>
          ) : null}
          <select
            value={record.status}
            onClick={(event) => event.stopPropagation()}
            onChange={(event) => updateRecord(record.id, { status: event.target.value as RecordStatus })}
            className="h-10 rounded-xl border border-slate-600/40 bg-slate-950/30 px-3 text-sm"
          >
            {statusOptionsByKind[record.kind].map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              if (window.confirm(`سيُنقل "${record.title}" إلى سلة المهملات ويمكن استعادته خلال 30 يوماً. هل تريد المتابعة؟`)) {
                updateRecord(record.id, { deletedAt: nowIso() });
              }
            }}
            className="danger-button"
          >
            <Trash2 className="size-4" aria-hidden="true" />
            حذف
          </button>
        </div>
        {editingRecordId === record.id ? (
          <form
            className="mt-4 grid gap-3 rounded-2xl border border-slate-600/35 bg-[#172641]/35 p-3 md:grid-cols-3"
            onClick={(event) => event.stopPropagation()}
            onSubmit={(event) => {
              event.preventDefault();
              updateRecordFromForm(record.id, new FormData(event.currentTarget));
            }}
          >
            <input name="title" defaultValue={record.title} placeholder="العنوان" className={fieldClass()} />
            <input name="city" defaultValue={record.city} placeholder="المدينة" className={fieldClass()} />
            <input name="district" defaultValue={record.district} placeholder="الحي" className={fieldClass()} />
            <input name="propertyType" defaultValue={record.propertyType} placeholder="نوع العقار" className={fieldClass()} />
            <input name="transaction" defaultValue={record.transaction} placeholder="نوع العملية" className={fieldClass()} />
            <input name="price" type="number" min="0" step="0.01" defaultValue={recordAmount(record) ?? ""} placeholder={record.kind === "offer" ? "السعر" : "الميزانية"} className={fieldClass()} />
            {record.kind === "offer" ? <input name="askingPrice" type="number" min="0" step="0.01" defaultValue={record.askingPrice ?? ""} placeholder="السوم" className={fieldClass()} /> : null}
            <input name="area" type="number" min="0" step="0.01" defaultValue={record.area ?? ""} placeholder="المساحة" className={fieldClass()} />
            <select name="basePriceMode" defaultValue={record.basePriceMode} className={fieldClass()}>
              <option value="limit">احتساب سعر المتر من الحد</option>
              <option value="asking">احتساب سعر المتر من السوم</option>
            </select>
            <input name="category" defaultValue={record.category} placeholder="التصنيف" className={fieldClass()} />
            <input name="propertyAge" defaultValue={record.propertyAge} placeholder="عمر العقار" className={fieldClass()} />
            <input name="streetWidth" type="number" min="0" step="0.01" defaultValue={record.streetWidth ?? ""} placeholder="عرض الشارع" className={fieldClass()} />
            <input name="facade" defaultValue={record.facade} placeholder="الواجهة" className={fieldClass()} />
            <input name="lengths" defaultValue={record.lengths} placeholder="الأطوال" className={fieldClass()} />
            <input name="planNumber" defaultValue={record.planNumber} placeholder="رقم المخطط" className={fieldClass()} />
            <input name="blockNumber" defaultValue={record.blockNumber} placeholder="رقم البلك" className={fieldClass()} />
            <input name="plotNumber" defaultValue={record.plotNumber} placeholder="رقم القطعة" className={fieldClass()} />
            <input name="bedrooms" type="number" min="0" defaultValue={record.bedrooms ?? ""} placeholder="غرف النوم" className={fieldClass()} />
            <input name="bathrooms" type="number" min="0" defaultValue={record.bathrooms ?? ""} placeholder="دورات المياه" className={fieldClass()} />
            <input name="contact" defaultValue={record.contact} placeholder="رقم التواصل" className={fieldClass()} />
            <input name="ownerName" defaultValue={record.ownerName} placeholder="اسم المالك/العميل" className={fieldClass()} />
            <input name="ownerPhone" defaultValue={record.ownerPhone} placeholder="جوال المالك/العميل" className={fieldClass()} />
            <input name="falLicense" defaultValue={record.falLicense || authUser?.falLicense} placeholder="رخصة فال" className={fieldClass()} />
            <input name="license" defaultValue={record.license} placeholder="رقم الإعلان العقاري" className={fieldClass()} />
            <input name="reminderDays" type="number" min="1" defaultValue={record.reminderDays} placeholder="مهلة التحديث بالأيام" className={fieldClass()} />
            <textarea name="notes" rows={4} defaultValue={record.notes} placeholder="نص الإعلان/الملاحظات" className={`${fieldClass()} h-auto py-3 leading-8 md:col-span-3`} />
            <LocationPicker key={`edit-${record.id}-${record.updatedAt}`} initialLatitude={record.lat} initialLongitude={record.lng} />
            <div className="flex flex-wrap justify-end gap-2 md:col-span-3">
              <button type="button" onClick={() => setEditingRecordId(null)} className="secondary-button">
                إلغاء
              </button>
              <button type="submit" className="primary-button">
                حفظ التعديل
              </button>
            </div>
          </form>
        ) : null}
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
      <section className="grid gap-5">
        <header className="flex items-start justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-2.5 text-2xl font-extrabold text-white md:text-3xl">
              <span className="flex size-10 items-center justify-center rounded-xl gold-gradient">
                {kind === "offer" ? <Building2 className="size-5 text-[#0f1f3d]" strokeWidth={2.5} aria-hidden="true" /> : <Search className="size-5 text-[#0f1f3d]" strokeWidth={2.5} aria-hidden="true" />}
              </span>
              {kind === "offer" ? "العروض" : "الطلبات"}
            </h1>
            <p className="mt-1.5 text-sm text-slate-400">{kind === "offer" ? "عقارات تعرضها لعملائك للبيع أو للإيجار" : "طلبات عملائك للشراء أو الاستئجار"}</p>
          </div>
          <button
            type="button"
            onClick={() => {
              setQuickKind(kind);
              setQuickEntryMode("manual");
              setQuickAddOpen(true);
            }}
            className="primary-button"
          >
            <Plus className="size-4" aria-hidden="true" />
            إضافة {recordKindLabels[kind]}
          </button>
        </header>

        <div className="grid gap-4">
          <div className="flex gap-1.5 overflow-x-auto px-1 pb-1 scrollbar-thin">
            <button
              type="button"
              onClick={() => setFilters((current) => ({ ...current, status: "all" }))}
              className={selectedStatusFilter === "all" ? "primary-button shrink-0" : "secondary-button shrink-0"}
            >
              الكل <span className="rounded-full bg-slate-950/20 px-2 py-0.5 text-xs">{activeRecords.filter((record) => record.kind === kind).length}</span>
            </button>
            {statusOptionsByKind[kind].map((option) => {
              const count = activeRecords.filter((record) => record.kind === kind && record.status === option.value).length;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setFilters((current) => ({ ...current, status: option.value }))}
                  className={selectedStatusFilter === option.value ? "primary-button shrink-0" : "secondary-button shrink-0"}
                >
                  {option.label} <span className="rounded-full bg-slate-950/20 px-2 py-0.5 text-xs">{count}</span>
                </button>
              );
            })}
          </div>
          <div className="grid gap-3 md:grid-cols-[1fr_14rem]">
            <div className="relative">
              <Search className="pointer-events-none absolute start-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
              <input
                value={filters.query}
                onChange={(event) => setFilters((current) => ({ ...current, query: event.target.value }))}
                placeholder="ابحث بالعنوان، الحي، المدينة، أو اسم المالك/العميل..."
                className={`${fieldClass()} ps-10`}
              />
            </div>
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
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{records.length > 0 ? records.map(renderRecordCard) : <EmptyState label="لا توجد سجلات مطابقة." />}</div>
      </section>
    );
  }

  function renderDashboard() {
    const totalValue = offers.reduce((sum, record) => sum + (record.price ?? 0), 0);
    const overdueRecords = activeRecords.filter((record) => {
      const age = clockNow - new Date(record.updatedAt).getTime();
      return age >= record.reminderDays * 24 * 60 * 60 * 1000;
    });

    function markRecordFresh(record: PropertyRecord) {
      const refreshedAt = nowIso();
      const nextDueAt = new Date(refreshedAt);
      nextDueAt.setDate(nextDueAt.getDate() + record.reminderDays);
      setWorkspace((current) => ({
        ...current,
        records: current.records.map((item) => (item.id === record.id ? { ...item, updatedAt: refreshedAt } : item)),
        reminders: [
          {
            id: makeId("rem"),
            recordId: record.id,
            title: `تحديث ${record.title}`,
            dueAt: nextDueAt.toISOString(),
            status: "scheduled",
          },
          ...current.reminders.map((item) => (item.recordId === record.id ? { ...item, status: "completed" as const } : item)),
        ],
        activities: [
          {
            id: makeId("activity"),
            type: "record_updated" as const,
            title: "تأكيد تحديث العقار",
            details: record.title,
            recordId: record.id,
            clientId: record.clientId || null,
            createdAt: refreshedAt,
          },
          ...current.activities,
        ].slice(0, 200),
      }));
      addNotification("تم تحديث العقار", `أعيد ضبط مهلة ${record.title} لمدة ${record.reminderDays} يوماً.`, "success");
    }

    function openUpdateMessage(record: PropertyRecord) {
      const phone = normalizePhone(record.ownerPhone || record.contact);
      const message = `السلام عليكم، نود تحديث حالة العقار: ${record.title}. هل ما زال متاحاً؟ وهل طرأ أي تغيير على السعر أو التفاصيل؟`;
      window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, "_blank", "noopener,noreferrer");
    }

    return (
      <section className="grid gap-4">
        <div className="grid gap-3 md:grid-cols-4">
          {renderMetric("العروض المتاحة", offers.filter((record) => record.status === "for_sale" || record.status === "for_rent").length, "teal", Building2)}
          {renderMetric("الطلبات المفتوحة", requests.filter((record) => record.status === "purchase" || record.status === "rental").length, "blue", Search)}
          {renderMetric("تذكيرات مستحقة", dueReminders, "amber", CalendarClock)}
          {renderMetric("قيمة العروض", formatMoney(totalValue), "slate", CircleDollarSign)}
        </div>
        <Panel title="إعلانات تجاوزت موعد التحديث">
          <div className="grid gap-3">
            {overdueRecords.length > 0 ? (
              overdueRecords.slice(0, 6).map((record) => (
                <div key={record.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-300/25 bg-amber-300/8 p-4">
                  <div>
                    <p className="font-black text-white">{record.title}</p>
                    <p className="mt-1 text-sm text-slate-400">آخر تحديث: {formatDateTime(record.updatedAt, workspace.profile.timezone)}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" disabled={!record.ownerPhone && !record.contact} onClick={() => openUpdateMessage(record)} className="primary-button disabled:cursor-not-allowed disabled:opacity-40">
                      <MessageCircle className="size-4" aria-hidden="true" />
                      مراسلة لتحديث العقار
                    </button>
                    <button type="button" onClick={() => markRecordFresh(record)} className="secondary-button">
                      <CheckCircle2 className="size-4" aria-hidden="true" />
                      تم التحديث
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <EmptyState label="لا توجد إعلانات متأخرة عن موعد التحديث." />
            )}
          </div>
        </Panel>
        <div className="grid gap-4 xl:grid-cols-[1.35fr_0.65fr]">
          <div className="rounded-2xl border border-slate-700/50 bg-[#0f1f3d] p-4 card-glow">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="text-lg font-black text-slate-50">أحدث السجلات</h2>
              <button type="button" onClick={() => setQuickAddOpen(true)} className="primary-button">
                <Plus className="size-4" aria-hidden="true" />
                إضافة سريع
              </button>
            </div>
            <div className="grid gap-3">{activeRecords.length > 0 ? activeRecords.slice(0, 4).map(renderRecordCard) : <EmptyState label="ابدأ بإضافة أول عرض أو طلب." />}</div>
          </div>
          <Panel title="سجل النشاط">
            <div className="relative grid gap-4 before:absolute before:bottom-2 before:right-[0.45rem] before:top-2 before:w-px before:bg-slate-600/40">
              {workspace.activities.length > 0 ? (
                workspace.activities.slice(0, 10).map((activity) => (
                  <div key={activity.id} className="relative pr-7">
                    <span className="absolute right-0 top-1.5 size-4 rounded-full border-4 border-[#0f1c34] bg-amber-300" />
                    <p className="font-black text-slate-100">{activity.title}</p>
                    <p className="mt-1 text-sm text-slate-400">{activity.details}</p>
                    <p className="mt-1 text-xs text-slate-500">{formatDateTime(activity.createdAt, workspace.profile.timezone)}</p>
                  </div>
                ))
              ) : (
                <EmptyState label="سيظهر هنا تاريخ الإضافات والتحديثات والمشاركات." />
              )}
            </div>
          </Panel>
        </div>
      </section>
    );
  }

  function renderQuickAddModal() {
    if (!quickAddOpen) {
      return null;
    }

    const basePrice = Number(quickBasePriceMode === "asking" ? quickAskingPrice : quickLimitPrice);
    const area = Number(quickArea);
    const pricePerMeter = basePrice > 0 && area > 0 ? basePrice / area : null;
    const facadeOptions = ["شمالية", "جنوبية", "شرقية", "غربية"];

    return (
      <div className="fixed inset-0 z-[80] overflow-y-auto bg-slate-950/80 p-3 backdrop-blur-sm lg:p-6" role="dialog" aria-modal="true" aria-label="إضافة سجل عقاري">
        <div className="mx-auto flex max-h-[92vh] max-w-3xl flex-col overflow-hidden rounded-2xl border border-[#c9972f]/25 bg-[#0f1f3d] text-white shadow-2xl">
          <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-slate-700/50 bg-[#0f1f3d]/95 p-4 backdrop-blur">
            <div>
              <p className="text-xs font-bold text-amber-300">إضافة سريع</p>
              <h2 className="mt-1 text-2xl font-black text-white">سجل عقاري جديد</h2>
            </div>
            <button type="button" onClick={() => setQuickAddOpen(false)} className="secondary-button" aria-label="إغلاق">
              <X className="size-5" aria-hidden="true" />
            </button>
          </div>

          <div className="grid gap-4 p-4 lg:p-6">
            <div className="grid grid-cols-3 gap-1.5 rounded-xl border border-slate-700/55 bg-[#172641]/50 p-1">
              {([
                ["manual", "إدخال يدوي"],
                ["whatsapp", "لصق واتساب"],
                ["voice", "إدخال صوتي"],
              ] as const).map(([id, label]) => (
                <button key={id} type="button" onClick={() => setQuickEntryMode(id)} className={quickEntryMode === id ? "primary-button justify-center" : "secondary-button justify-center"}>
                  {id === "voice" ? <Mic2 className="size-4" aria-hidden="true" /> : id === "manual" ? <Plus className="size-4" aria-hidden="true" /> : <Sparkles className="size-4" aria-hidden="true" />}
                  <span className="hidden sm:inline">{label}</span>
                </button>
              ))}
            </div>

            {quickEntryMode === "manual" ? (
              <form
                key={recordFormVersion}
                className="grid gap-5"
                onSubmit={(event) => {
                  event.preventDefault();
                  addRecord(quickKind, new FormData(event.currentTarget));
                }}
              >
                <div className="grid grid-cols-2 gap-2 rounded-xl border border-slate-700/55 bg-[#172641]/50 p-1">
                  <button type="button" onClick={() => setQuickKind("offer")} className={quickKind === "offer" ? "primary-button justify-center" : "secondary-button justify-center"}>عرض — أملك عقاراً</button>
                  <button type="button" onClick={() => setQuickKind("request")} className={quickKind === "request" ? "primary-button justify-center" : "secondary-button justify-center"}>طلب — مطلوب من عميل</button>
                </div>

                <section className="grid gap-3 rounded-2xl border border-slate-700/55 bg-[#172641]/35 p-4">
                  <h3 className="font-black text-amber-100">البيانات الأساسية</h3>
                  <div className="grid gap-3 md:grid-cols-3">
                    <select name="status" defaultValue={quickKind === "offer" ? "for_sale" : "purchase"} className={fieldClass()}>
                      {statusOptionsByKind[quickKind].map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                    </select>
                    <select name="category" className={fieldClass()}>
                      <option value="">التصنيف</option><option value="سكني">سكني</option><option value="تجاري">تجاري</option><option value="صناعي">صناعي</option><option value="زراعي">زراعي</option>
                    </select>
                    <select name="propertyType" className={fieldClass()} required>
                      <option value="">نوع العقار</option>
                      {["أرض", "فيلا", "شقة", "عمارة", "بلك", "مستودع", "استراحة", "مكتب", "محل", "مزرعة", "أخرى"].map((item) => <option key={item} value={item}>{item}</option>)}
                    </select>
                    <input name="title" required placeholder="عنوان الإعلان" className={fieldClass()} />
                    <input name="city" required defaultValue="الرياض" placeholder="المدينة" className={fieldClass()} />
                    <input name="district" required placeholder={quickKind === "offer" ? "الحي" : "الأحياء المطلوبة"} className={fieldClass()} />
                    <input name="propertyAge" placeholder={quickKind === "offer" ? "عمر العقار: جديد أو عدد السنوات" : "العمر المفضّل"} className={fieldClass()} />
                  </div>
                </section>

                <section className="grid gap-3 rounded-2xl border border-slate-700/55 bg-[#172641]/35 p-4">
                  <h3 className="font-black text-amber-100">السعر والمساحة</h3>
                  <div className="grid gap-3 md:grid-cols-3">
                    <Field label={quickKind === "offer" ? "سعر البيع / الحد (ريال)" : "الميزانية القصوى (ريال)"}>
                      <input name="price" type="number" min="0" step="0.01" value={quickLimitPrice} onChange={(event) => setQuickLimitPrice(event.target.value)} placeholder="0" className={fieldClass()} />
                    </Field>
                    {quickKind === "offer" ? (
                      <Field label="سعر السوم (ريال)">
                        <input name="askingPrice" type="number" min="0" step="0.01" value={quickAskingPrice} onChange={(event) => setQuickAskingPrice(event.target.value)} placeholder="0" className={fieldClass()} />
                      </Field>
                    ) : null}
                    <Field label="المساحة (م²)">
                      <input name="area" type="number" min="0" step="0.01" value={quickArea} onChange={(event) => setQuickArea(event.target.value)} placeholder="مثال 344.5" className={fieldClass()} />
                    </Field>
                    {quickKind === "offer" ? (
                      <Field label="السعر الأساسي للحساب">
                        <select name="basePriceMode" value={quickBasePriceMode} onChange={(event) => setQuickBasePriceMode(event.target.value as "limit" | "asking")} className={fieldClass()}>
                          <option value="limit">الحد</option><option value="asking">السوم</option>
                        </select>
                      </Field>
                    ) : <input type="hidden" name="basePriceMode" value="limit" />}
                    <div className="flex h-11 items-center rounded-xl border border-emerald-300/25 bg-emerald-400/10 px-3 text-sm font-black text-emerald-100">سعر المتر: {pricePerMeter ? formatMoney(pricePerMeter) : "يُحسب تلقائياً"}</div>
                  </div>
                </section>

                <section className="grid gap-3 rounded-2xl border border-slate-700/55 bg-[#172641]/35 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h3 className="font-black text-amber-100">صور العقار</h3>
                      <p className="mt-1 text-xs font-bold text-slate-400">اختياري. JPG/PNG/WebP حتى 5MB للصورة.</p>
                    </div>
                    <label className="secondary-button cursor-pointer">
                      <Camera className="size-4" aria-hidden="true" />
                      <span>الكاميرا/المعرض</span>
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        capture="environment"
                        multiple
                        className="sr-only"
                        onChange={(event) => {
                          const files = Array.from(event.target.files ?? []);
                          event.currentTarget.value = "";
                          void Promise.all(files.map(uploadPropertyImage));
                        }}
                      />
                    </label>
                  </div>
                  {quickImages.length > 0 ? (
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                      {quickImages.map((image) => (
                        <div key={image.id} className="overflow-hidden rounded-xl border border-slate-600/30 bg-slate-950/25">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={image.url} alt={image.name} className="h-32 w-full object-cover" />
                          <div className="grid gap-2 p-2">
                            <button type="button" onClick={() => setQuickImages((current) => current.map((item) => ({ ...item, main: item.id === image.id })))} className={image.main ? "primary-button justify-center" : "secondary-button justify-center"}>
                              <ImageIcon className="size-4" aria-hidden="true" />
                              {image.main ? "الصورة الرئيسية" : "اجعلها رئيسية"}
                            </button>
                            <button type="button" onClick={() => setQuickImages((current) => current.filter((item) => item.id !== image.id))} className="danger-button justify-center">
                              إزالة
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-xl border border-dashed border-slate-600/35 bg-slate-950/20 p-4 text-sm font-bold text-slate-400">
                      <UploadCloud className="mb-2 size-5 text-amber-200" aria-hidden="true" />
                      لم تتم إضافة صور بعد.
                    </div>
                  )}
                </section>

                <section className="grid gap-3 rounded-2xl border border-slate-700/55 bg-[#172641]/35 p-4">
                  <h3 className="font-black text-amber-100">التفاصيل الفنية والتراخيص</h3>
                  <div>
                    <p className="mb-2 text-sm font-bold text-slate-300">الواجهات — يمكن اختيار أكثر من واجهة</p>
                    <div className="flex flex-wrap gap-2">
                      {facadeOptions.map((facade) => (
                        <label key={facade} className={quickFacades.includes(facade) ? "cursor-pointer rounded-xl border border-amber-300/40 bg-amber-300/15 px-3 py-2 text-sm font-black text-amber-100" : "cursor-pointer rounded-xl border border-slate-600/30 bg-slate-950/25 px-3 py-2 text-sm font-bold text-slate-300"}>
                          <input type="checkbox" name="facades" value={facade} checked={quickFacades.includes(facade)} onChange={(event) => setQuickFacades((current) => event.target.checked ? [...current, facade] : current.filter((item) => item !== facade))} className="sr-only" />
                          {facade}
                        </label>
                      ))}
                    </div>
                  </div>
                  <div className="grid gap-3 md:grid-cols-3">
                    <input name="lengths" placeholder="الأطوال" className={fieldClass()} />
                    <input name="streetWidth" type="number" min="0" placeholder="عرض الشارع" className={fieldClass()} />
                    <input name="planNumber" placeholder="رقم المخطط" className={fieldClass()} />
                    <input name="blockNumber" placeholder="رقم البلك" className={fieldClass()} />
                    <input name="plotNumber" placeholder="رقم القطعة" className={fieldClass()} />
                    <input name="falLicense" defaultValue={authUser?.falLicense} placeholder="رقم رخصة فال" className={fieldClass()} />
                    <input name="license" placeholder="رقم الإعلان العقاري" className={fieldClass()} />
                  </div>
                </section>

                <section className="grid gap-3 rounded-2xl border border-slate-700/55 bg-[#172641]/35 p-4">
                  <h3 className="font-black text-amber-100">العميل والموقع والمتابعة</h3>
                  <div className="grid gap-3 md:grid-cols-3">
                    <select name="clientId" className={fieldClass()}><option value="">إنشاء/ربط العميل من البيانات أدناه</option>{workspace.clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}</select>
                    <input name="ownerName" placeholder={quickKind === "offer" ? "اسم المالك" : "اسم العميل"} className={fieldClass()} />
                    <input name="ownerPhone" inputMode="tel" placeholder="رقم الجوال" className={fieldClass()} />
                  </div>
                  <LocationPicker key={`quick-${recordFormVersion}-${quickKind}`} />
                  <div>
                    <p className="mb-2 text-sm font-bold text-slate-300">تنبيه التحديث</p>
                    <div className="flex flex-wrap gap-2">
                      {[7, 14, 30].map((days) => <label key={days} className="cursor-pointer rounded-xl border border-slate-600/30 bg-slate-950/25 px-3 py-2 text-sm font-bold"><input type="radio" name="reminderDays" value={days} defaultChecked={days === workspace.profile.defaultReminderDays || (days === 14 && ![7, 14, 30].includes(workspace.profile.defaultReminderDays))} className="ml-2" />خلال {days} يوماً</label>)}
                      <input name="reminderDays" type="number" min="1" placeholder="مدة أخرى" className={`${fieldClass()} max-w-36`} />
                    </div>
                  </div>
                  <textarea name="notes" rows={5} placeholder="معلومات إضافية أو ملاحظات" className={`${fieldClass()} h-auto py-3 leading-8`} />
                </section>

                <div className="flex flex-wrap justify-end gap-2">
                  <button type="button" onClick={() => setQuickAddOpen(false)} className="secondary-button">إلغاء</button>
                  <button type="submit" className="primary-button"><CheckCircle2 className="size-4" aria-hidden="true" />حفظ السجل</button>
                </div>
              </form>
            ) : (
              <div className="grid gap-3">
                <p className="rounded-2xl border border-sky-300/20 bg-sky-400/10 p-3 text-sm font-bold text-sky-100">
                  {quickEntryMode === "voice" ? "اضغط تسجيل صوتي مباشر، ثم راجع الحقول المستخرجة قبل الحفظ." : "الصق رسالة واتساب، حلّلها، ثم راجع الحقول المستخرجة قبل الحفظ."}
                </p>
                {renderAiEntry()}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  function renderAiEntry() {
    return (
      <section className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <div className="rounded-2xl border border-slate-700/50 bg-[#0f1f3d] p-4 card-glow">
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
          {aiProgress ? <p className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm font-bold text-amber-900">{aiProgress}</p> : null}
          {aiError ? <p className="mt-3 rounded-md border border-rose-200 bg-rose-50 p-3 text-sm font-bold text-rose-800">{aiError}</p> : null}
        </div>
        <div className="rounded-2xl border border-slate-700/50 bg-[#0f1f3d] p-4 card-glow">
          <h2 className="mb-4 text-lg font-black text-slate-950">نتيجة المراجعة قبل الحفظ</h2>
          {aiResult ? (
            <div className="grid gap-3">
              <p className="rounded-md border border-teal-100 bg-teal-50 p-3 text-sm font-bold leading-7 text-teal-900">
                راجع وعدّل البيانات قبل الحفظ. رقم الجوال/الرخصة/الموقع يمكن تعديلها هنا أو بعد الحفظ من بطاقة الإعلان.
              </p>
              <div className="grid gap-3 md:grid-cols-2">
                <select
                  value={aiResult.recordType}
                  onChange={(event) => updateAiResult({ recordType: event.target.value as PropertyData["recordType"] })}
                  className={fieldClass()}
                >
                  <option value="offer">عرض</option>
                  <option value="request">طلب</option>
                </select>
                <select
                  value={aiResult.transactionType ?? ""}
                  onChange={(event) => updateAiResult({ transactionType: (event.target.value || null) as PropertyData["transactionType"] })}
                  className={fieldClass()}
                >
                  <option value="">نوع العملية</option>
                  {Object.entries(transactionLabels)
                    .filter(([value]) => value !== "unknown")
                    .map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                </select>
                <select
                  value={aiResult.propertyType ?? ""}
                  onChange={(event) => updateAiResult({ propertyType: (event.target.value || null) as PropertyData["propertyType"] })}
                  className={fieldClass()}
                >
                  <option value="">نوع العقار</option>
                  {Object.entries(propertyTypeLabels)
                    .filter(([value]) => value !== "unknown")
                    .map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                </select>
                <input value={aiResult.city ?? ""} onChange={(event) => updateAiResult({ city: event.target.value || null })} placeholder="المدينة" className={fieldClass()} />
                <input
                  value={aiResult.districts.join("، ")}
                  onChange={(event) =>
                    updateAiResult({
                      districts: event.target.value
                        .split(/[,،]/)
                        .map((item) => item.trim())
                        .filter(Boolean),
                    })
                  }
                  placeholder="الأحياء"
                  className={fieldClass()}
                />
                <input
                  type="number"
                  min="0"
                  value={aiResult.recordType === "offer" ? aiResult.price ?? "" : aiResult.maximumBudget ?? ""}
                  onChange={(event) =>
                    updateAiResult(
                      aiResult.recordType === "offer"
                        ? { price: optionalPositiveNumber(event.target.value) }
                        : { maximumBudget: optionalPositiveNumber(event.target.value) },
                    )
                  }
                  placeholder={aiResult.recordType === "offer" ? "السعر" : "الميزانية"}
                  className={fieldClass()}
                />
                <input type="number" min="0" value={aiResult.area ?? ""} onChange={(event) => updateAiResult({ area: optionalPositiveNumber(event.target.value) })} placeholder="المساحة" className={fieldClass()} />
                <input type="number" min="0" value={aiResult.streetWidth ?? ""} onChange={(event) => updateAiResult({ streetWidth: optionalPositiveNumber(event.target.value) })} placeholder="عرض الشارع" className={fieldClass()} />
                <input value={aiResult.facade ?? ""} onChange={(event) => updateAiResult({ facade: event.target.value || null })} placeholder="الواجهة" className={fieldClass()} />
                <input value={aiResult.contactNumber ?? ""} onChange={(event) => updateAiResult({ contactNumber: event.target.value || null })} placeholder="رقم التواصل" className={fieldClass()} />
                <input value={aiResult.licenseNumber ?? ""} onChange={(event) => updateAiResult({ licenseNumber: event.target.value || null })} placeholder="رقم الإعلان العقاري" className={fieldClass()} />
              </div>
              <textarea
                value={aiResult.description ?? ""}
                onChange={(event) => updateAiResult({ description: event.target.value || null })}
                rows={5}
                placeholder="نص الإعلان بعد إعادة الصياغة"
                className={`${fieldClass()} h-auto py-3 leading-8`}
              />
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
    const listContent = (
      <div className="divide-y divide-slate-700/60">
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
                "flex w-full items-center gap-3 px-4 py-3 text-start transition hover:bg-[#172641]/60",
                selectedShareId === record.id ? "bg-[#c9972f]/10" : "",
              ].join(" ")}
            >
              <span className="size-3 shrink-0 rounded-full border border-white/40 bg-[#c9972f]" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-bold text-white">{record.title}</span>
                <span className="mt-0.5 block text-[11px] text-slate-400">
                  {record.city}، {record.district} • {recordKindLabels[record.kind]} • {statusLabels[record.status]}
                </span>
              </span>
              <span className="shrink-0 text-xs font-extrabold text-[#e5bc55] nums-latin">{formatMoney(recordAmount(record))}</span>
            </button>
          ))
        ) : (
          <EmptyState label="لا توجد سجلات مطابقة بإحداثيات صالحة." />
        )}
      </div>
    );

    return (
      <section className="relative h-[calc(100vh-5rem)] overflow-hidden md:grid md:h-[calc(100vh-4.5rem)] md:grid-cols-[26rem_1fr]">
        <div className="hidden flex-col border-l border-slate-700/50 bg-[#0c1a36] md:flex">
          <div className="space-y-3 border-b border-slate-700/50 p-4">
            <h1 className="text-xl font-extrabold text-white">خريطة السجلات</h1>
            <div className="grid gap-3 md:grid-cols-[1fr_10rem]">
              <input
                value={filters.query}
                onChange={(event) => setFilters((current) => ({ ...current, query: event.target.value }))}
                placeholder="بحث في الخريطة..."
                className={fieldClass()}
              />
              <select value={filters.city} onChange={(event) => setFilters((current) => ({ ...current, city: event.target.value }))} className={fieldClass()}>
                <option value="all">كل المدن</option>
                {cities.map((city) => <option key={city} value={city}>{city}</option>)}
              </select>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto scrollbar-thin">{listContent}</div>
          <div className="border-t border-slate-700/50 p-3 text-center text-[11px] text-slate-400">
            {visibleRecords.length} سجل على الخريطة
          </div>
        </div>

        <div className="relative h-full min-h-[calc(100vh-9rem)]">
          <RealEstateMap
            records={mapRecords}
            selectedId={selectedShareId}
            hoveredId={hoveredMapId}
            onSelect={selectMapRecord}
            className="h-full min-h-[calc(100vh-9rem)]"
          />
          <div className="absolute inset-x-3 top-3 z-10 rounded-2xl border border-slate-700/60 bg-[#0c1a36]/90 p-2.5 backdrop-blur md:hidden">
            <div className="grid gap-2">
              <input
                value={filters.query}
                onChange={(event) => setFilters((current) => ({ ...current, query: event.target.value }))}
                placeholder="بحث في الخريطة..."
                className={fieldClass()}
              />
              <select value={filters.city} onChange={(event) => setFilters((current) => ({ ...current, city: event.target.value }))} className={fieldClass()}>
                <option value="all">كل المدن</option>
                {cities.map((city) => <option key={city} value={city}>{city}</option>)}
              </select>
            </div>
          </div>
          <div
            className={[
              "absolute inset-x-0 bottom-0 z-20 flex flex-col rounded-t-3xl border-t border-[#c9972f]/30 bg-[#0c1a36] shadow-2xl transition-all duration-300 md:hidden",
              isMobileMapOpen ? "h-[62%]" : "h-14",
            ].join(" ")}
          >
            <button type="button" onClick={() => setIsMobileMapOpen((current) => !current)} className="h-14 shrink-0 font-extrabold text-white">
              قائمة السجلات ({visibleRecords.length})
            </button>
            {isMobileMapOpen ? <div className="flex-1 overflow-y-auto scrollbar-thin">{listContent}</div> : null}
          </div>
        </div>
      </section>
    );
  }

  function renderClients() {
    const sharedCount = activeRecords.filter((record) => record.sharedAt).length;
    const whatsappCount = workspace.activities.filter((activity) => activity.type === "share_sent").length;
    return (
      <section className="grid gap-4">
        <div className="grid gap-3 md:grid-cols-3">
          {renderMetric("إجمالي جهات الاتصال", workspace.clients.length, "teal", Users)}
          {renderMetric("مشاركات مسجلة", sharedCount, "blue", Share2)}
          {renderMetric("عبر واتساب", whatsappCount, "amber", MessageCircle)}
        </div>
        <div className="grid gap-4 xl:grid-cols-[0.72fr_1.28fr]">
        <form
          className="h-fit rounded-2xl border border-slate-700/50 bg-[#0f1f3d] p-4 card-glow"
          onSubmit={(event) => {
            event.preventDefault();
            addClient(new FormData(event.currentTarget));
            event.currentTarget.reset();
          }}
        >
          <div className="mb-4 flex items-center gap-2 text-slate-50">
            <UserPlus className="size-5 text-amber-300" aria-hidden="true" />
            <h2 className="text-lg font-black">إضافة عميل</h2>
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
          {workspace.clients.length > 0 ? workspace.clients.map((client) => {
            const clientActivities = workspace.activities.filter((activity) => activity.clientId === client.id);
            const clientRecords = activeRecords.filter((record) => record.clientId === client.id);
            const isExpanded = expandedClientId === client.id;
            return (
            <article key={client.id} className="rounded-2xl border border-slate-700/50 bg-[#0f1f3d] p-4 card-glow">
              <button type="button" onClick={() => setExpandedClientId(isExpanded ? null : client.id)} className="flex w-full flex-wrap items-start justify-between gap-3 text-right">
                <div>
                  <h3 className="text-lg font-black text-slate-50">{client.name}</h3>
                  <p className="mt-1 text-sm text-slate-400">
                    {clientTypeLabels[client.type]} | {client.phone || "لا يوجد رقم"}
                  </p>
                </div>
                <span className="rounded-full border border-amber-300/25 bg-amber-300/10 px-3 py-1 text-xs font-bold text-amber-100">{clientRecords.length} سجلات</span>
              </button>
              <p className="mt-3 text-sm leading-7 text-slate-400">{client.notes || "لا توجد ملاحظات."}</p>
              <p className="mt-3 text-xs text-slate-500">آخر تواصل: {formatDateTime(client.lastContactAt, workspace.profile.timezone)}</p>
              {isExpanded ? (
                <div className="mt-4 border-t border-slate-600/25 pt-4">
                  <div className="mb-3 flex items-center gap-2 text-amber-100"><History className="size-4" aria-hidden="true" /><p className="font-black">سجل المتابعة</p></div>
                  <div className="grid gap-3">
                    {clientActivities.length > 0 ? clientActivities.map((activity) => (
                      <div key={activity.id} className="rounded-xl border border-slate-600/25 bg-slate-950/25 p-3">
                        <p className="font-bold text-slate-100">{activity.title}</p>
                        <p className="mt-1 text-sm text-slate-400">{activity.details}</p>
                        <p className="mt-1 text-xs text-slate-500">{formatDateTime(activity.createdAt, workspace.profile.timezone)}</p>
                      </div>
                    )) : <EmptyState label="لا توجد حركات مسجلة لهذا العميل بعد." />}
                  </div>
                </div>
              ) : null}
            </article>
          );}) : <EmptyState label="لا يوجد عملاء بعد. يمكن إضافتهم هنا أو تلقائياً عند حفظ سجل." />}
        </div>
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
              <div key={reminder.id} className="rounded-2xl border border-slate-700/50 bg-[#0f1f3d] p-4 card-glow">
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
            <div key={item.id} className={`rounded-2xl border p-4 card-glow ${item.read ? "border-slate-200 bg-white" : "border-teal-200 bg-teal-50"}`}>
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
    const text = selectedShareRecord ? recordShareText(selectedShareRecord, publicShareOptions) : "";
    const textWithLink = publicShareUrl ? `${text}\n\nرابط التفاصيل: ${publicShareUrl}` : text;
    const whatsappUrl = selectedShareRecord
      ? `https://wa.me/?text=${encodeURIComponent(textWithLink)}`
      : "#";
    const xUrl = selectedShareRecord
      ? `https://twitter.com/intent/tweet?text=${encodeURIComponent(textWithLink)}`
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
          <div className="mt-4 grid gap-3 rounded-2xl border border-slate-700/50 bg-[#172641]/35 p-3">
            <p className="font-black text-slate-950">بيانات الرابط العام</p>
            <label className="flex items-center gap-2 text-sm font-bold text-slate-700">
              <input
                type="checkbox"
                checked={publicShareOptions.includePrice}
                onChange={(event) => updatePublicShareOptions({ includePrice: event.target.checked })}
              />
              إظهار السعر أو الميزانية
            </label>
            <label className="flex items-center gap-2 text-sm font-bold text-slate-700">
              <input
                type="checkbox"
                checked={publicShareOptions.includeAskingPrice}
                onChange={(event) => updatePublicShareOptions({ includeAskingPrice: event.target.checked })}
              />
              إظهار السوم
            </label>
            <label className="flex items-center gap-2 text-sm font-bold text-slate-700">
              <input
                type="checkbox"
                checked={publicShareOptions.includeArea}
                onChange={(event) => updatePublicShareOptions({ includeArea: event.target.checked })}
              />
              إظهار المساحة
            </label>
            <label className="flex items-center gap-2 text-sm font-bold text-slate-700">
              <input
                type="checkbox"
                checked={publicShareOptions.includeContact}
                onChange={(event) => updatePublicShareOptions({ includeContact: event.target.checked })}
              />
              إظهار بيانات التواصل
            </label>
            <label className="flex items-center gap-2 text-sm font-bold text-slate-700">
              <input
                type="checkbox"
                checked={publicShareOptions.includeNotes}
                onChange={(event) => updatePublicShareOptions({ includeNotes: event.target.checked })}
              />
              إظهار الملاحظات
            </label>
            <label className="flex items-center gap-2 text-sm font-bold text-slate-700">
              <input
                type="checkbox"
                checked={publicShareOptions.includeMap}
                onChange={(event) => updatePublicShareOptions({ includeMap: event.target.checked })}
              />
              إظهار الموقع على الخريطة إذا توفرت الإحداثيات
            </label>
            <select
              value={publicShareOptions.expiresInDays ?? "never"}
              onChange={(event) =>
                updatePublicShareOptions({ expiresInDays: event.target.value === "never" ? null : Number(event.target.value) })
              }
              className={fieldClass()}
            >
              <option value="7">صلاحية 7 أيام</option>
              <option value="30">صلاحية 30 يوم</option>
              <option value="90">صلاحية 90 يوم</option>
              <option value="never">بدون انتهاء</option>
            </select>
            <button type="button" onClick={createPublicShareLink} disabled={!selectedShareRecord || publicShareBusy} className="primary-button justify-center">
              <Share2 className="size-4" aria-hidden="true" />
              {publicShareBusy ? "جاري إنشاء الرابط..." : "إنشاء رابط عام"}
            </button>
            {publicShareMessage ? <p className="rounded-md bg-white p-3 text-sm font-bold leading-7 text-slate-700">{publicShareMessage}</p> : null}
            {publicShareUrl ? (
              <button
                type="button"
                onClick={() => void navigator.clipboard?.writeText(publicShareUrl)}
                className="secondary-button justify-center break-all"
              >
                <ClipboardCopy className="size-4" aria-hidden="true" />
                نسخ الرابط العام
              </button>
            ) : null}
          </div>
          <div className="mt-4 grid gap-2">
            <a href={whatsappUrl} target="_blank" rel="noreferrer" onClick={() => selectedShareRecord && markShared(selectedShareRecord.id)} className="primary-button justify-center">
              <MessageCircle className="size-4" aria-hidden="true" />
              فتح واتساب مع الرابط
            </a>
            <a href={xUrl} target="_blank" rel="noreferrer" onClick={() => selectedShareRecord && markShared(selectedShareRecord.id)} className="secondary-button justify-center">
              <Send className="size-4" aria-hidden="true" />
              مشاركة عبر X مع الرابط
            </a>
            <button
              type="button"
              onClick={() => {
                void navigator.clipboard?.writeText(textWithLink);
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
          <pre className="min-h-64 whitespace-pre-wrap rounded-2xl border border-slate-700/50 bg-[#172641]/35 p-4 leading-8 text-slate-800">
            {textWithLink || "اختر سجلاً لتجهيز نص المشاركة."}
          </pre>
          <div className="mt-4 grid gap-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-black text-slate-950">روابط تم إنشاؤها</p>
              <button type="button" onClick={() => void loadPublicShareLinks()} className="secondary-button">
                تحديث الروابط
              </button>
            </div>
            {publicShareLinks.length > 0 ? (
              publicShareLinks.slice(0, 8).map((share) => (
                <div key={share.id} className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-slate-200 bg-slate-50 p-3">
                  <div>
                    <p className="font-bold text-slate-900">{share.title}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {share.revoked_at
                        ? "ملغى"
                        : share.expires_at
                          ? `ينتهي في ${formatDateTime(share.expires_at, workspace.profile.timezone)}`
                          : "بدون انتهاء"}
                    </p>
                  </div>
                  {!share.revoked_at ? (
                    <button type="button" onClick={() => void revokePublicShareLink(share.id)} className="danger-button">
                      إلغاء الرابط
                    </button>
                  ) : null}
                </div>
              ))
            ) : (
              <EmptyState label="لم يتم إنشاء روابط عامة بعد." />
            )}
          </div>
        </Panel>
      </section>
    );
  }

  function renderShareModal() {
    if (!shareModalOpen) {
      return null;
    }

    return (
      <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/75 p-3 backdrop-blur" role="dialog" aria-modal="true">
        <div className="mx-auto max-w-4xl rounded-2xl border border-slate-600/35 bg-[#0a162a] shadow-2xl">
          <div className="sticky top-0 z-10 flex items-center justify-between gap-3 rounded-t-2xl border-b border-slate-600/30 bg-[#0a162a]/95 p-4">
            <div>
              <p className="text-xs font-bold text-amber-300">مشاركة من نفس الصفحة</p>
              <h2 className="text-xl font-black text-white">{selectedShareRecord?.title ?? "مشاركة عقارية"}</h2>
            </div>
            <button type="button" onClick={() => setShareModalOpen(false)} className="secondary-button" aria-label="إغلاق المشاركة">
              <X className="size-5" aria-hidden="true" />
            </button>
          </div>
          <div className="p-4">{renderSharing()}</div>
        </div>
      </div>
    );
  }

  function renderRecordDetailsModal() {
    const record = selectedRecordId ? activeRecords.find((item) => item.id === selectedRecordId) : null;
    if (!record) {
      return null;
    }

    const client = workspace.clients.find((item) => item.id === record.clientId);
    const pricePerMeter = recordPricePerMeter(record);

    return (
      <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/75 p-3 backdrop-blur" role="dialog" aria-modal="true">
        <div className="mx-auto max-w-4xl rounded-2xl border border-slate-600/35 bg-[#0a162a] shadow-2xl">
          <div className="sticky top-0 z-10 flex items-center justify-between gap-3 rounded-t-2xl border-b border-slate-600/30 bg-[#0a162a]/95 p-4">
            <div>
              <p className="text-xs font-bold text-amber-300">{recordKindLabels[record.kind]} | {statusLabels[record.status]}</p>
              <h2 className="text-2xl font-black text-white">{record.title}</h2>
            </div>
            <button type="button" onClick={() => setSelectedRecordId(null)} className="secondary-button" aria-label="إغلاق التفاصيل">
              <X className="size-5" aria-hidden="true" />
            </button>
          </div>
          <div className="grid gap-4 p-4">
            {record.images.length > 0 ? (
              <div className="grid gap-3 sm:grid-cols-3">
                {record.images.map((image) => (
                  <div key={image.id} className="contents">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={image.url} alt={image.name} className="h-44 w-full rounded-lg border border-slate-600/30 object-cover" />
                  </div>
                ))}
              </div>
            ) : null}
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Info label="النوع" value={record.propertyType} />
              <Info label="الموقع" value={`${record.city}، ${record.district}`} />
              <Info label={record.kind === "offer" ? "السعر/الحد" : "الميزانية"} value={formatMoney(recordAmount(record))} />
              <Info label="المساحة" value={formatArea(record.area)} />
              <Info label="السوم" value={formatMoney(record.askingPrice)} />
              <Info label="سعر المتر" value={pricePerMeter ? formatMoney(pricePerMeter) : "غير محدد"} />
              <Info label="الواجهة" value={record.facades.join("، ") || record.facade || "غير محدد"} />
              <Info label="عرض الشارع" value={record.streetWidth ? `${record.streetWidth} متر` : "غير محدد"} />
              <Info label="المخطط" value={record.planNumber || "غير محدد"} />
              <Info label="البلك/القطعة" value={[record.blockNumber, record.plotNumber].filter(Boolean).join(" / ") || "غير محدد"} />
              <Info label="رخصة فال" value={record.falLicense || authUser?.falLicense || "غير مضافة"} />
              <Info label="رقم الإعلان" value={record.license || "غير مضاف"} />
              <Info label="العميل" value={client?.name || record.ownerName || "غير مرتبط"} />
              <Info label="الجوال" value={client?.phone || record.ownerPhone || record.contact || "غير مضاف"} />
              <Info label="آخر تحديث" value={formatDateTime(record.updatedAt, workspace.profile.timezone)} />
              <Info label="مهلة التذكير" value={`${record.reminderDays} يوم`} />
            </div>
            <div className="rounded-xl border border-slate-600/25 bg-slate-950/25 p-4">
              <p className="text-xs font-bold text-slate-400">النص والملاحظات</p>
              <p className="mt-2 whitespace-pre-wrap leading-8 text-slate-100">{record.notes || "لا توجد ملاحظات."}</p>
            </div>
            <div className="flex flex-wrap justify-end gap-2">
              <button type="button" onClick={() => { setSelectedRecordId(null); setEditingRecordId(record.id); window.setTimeout(() => document.getElementById(`record-${record.id}`)?.scrollIntoView({ block: "center", behavior: "smooth" }), 30); }} className="secondary-button">
                تعديل
              </button>
              <button type="button" onClick={() => { setSelectedShareId(record.id); setShareModalOpen(true); }} className="primary-button">
                <Share2 className="size-4" aria-hidden="true" />
                مشاركة
              </button>
              <button type="button" onClick={() => { setSelectedRecordId(null); setQuickKind(record.kind); setQuickEntryMode("manual"); setQuickAddOpen(true); }} className="secondary-button">
                إضافة آخر
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  function renderTrash() {
    return (
      <Panel title="سلة المهملات - حذف ناعم 30 يوماً">
        <div className="grid gap-3">
          {trashedRecords.length > 0 ? (
            trashedRecords.map((record) => (
              <div key={record.id} className="rounded-2xl border border-slate-700/50 bg-[#0f1f3d] p-4 card-glow">
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
                      onClick={() => {
                        if (window.confirm(`حذف "${record.title}" نهائياً؟ لا يمكن التراجع عن هذا الإجراء.`)) {
                          setWorkspace((current) => ({
                            ...current,
                            records: current.records.filter((item) => item.id !== record.id),
                          }));
                        }
                      }}
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

  function renderAuthControls() {
    const visibleAuthMode = authMode === "register" || authMode === "confirm" ? "register" : "login";
    const authTitle =
      authMode === "register"
        ? "تسجيل جديد"
        : authMode === "confirm"
          ? "تأكيد البريد"
          : authMode === "forgot" || authMode === "reset"
            ? "استعادة كلمة المرور"
            : "تسجيل الدخول";

    return (
      <Panel title={authTitle}>
        <div className="grid gap-3">
          {authUser ? (
            <div className="grid gap-3">
              <Info label="الحساب الحالي" value={authUser.email ?? "مستخدم"} />
              <button type="button" onClick={signOut} className="secondary-button justify-center">
                تسجيل الخروج
              </button>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-2 rounded-2xl border border-slate-600/20 bg-slate-950/25 p-1 text-sm font-black">
                {[
                  { id: "login", label: "دخول" },
                  { id: "register", label: "تسجيل" },
                ].map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setAuthMode(item.id as typeof authMode)}
                    className={[
                      "rounded-xl px-3 py-3 transition",
                      visibleAuthMode === item.id ? "bg-amber-300 text-slate-950 shadow-sm" : "text-slate-300 hover:bg-slate-800/70 hover:text-white",
                    ].join(" ")}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
              {authMode === "register" || authMode === "confirm" ? (
                <div className="rounded-2xl border border-amber-300/20 bg-slate-950/25 p-4">
                  <div className="mb-3 flex items-center justify-between text-sm font-black text-amber-100">
                    <span>{authMode === "confirm" ? "خطوة تأكيد البريد" : "بيانات الحساب"}</span>
                    <span dir="ltr">{authMode === "confirm" ? "2/2" : "1/2"}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <span className={["h-1.5 rounded-full", authMode === "register" || authMode === "confirm" ? "bg-amber-300" : "bg-slate-700"].join(" ")} />
                    <span className={["h-1.5 rounded-full", authMode === "confirm" ? "bg-amber-300" : "bg-slate-700"].join(" ")} />
                  </div>
                </div>
              ) : null}
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  const formData = new FormData(event.currentTarget);
                  if (authMode === "register") {
                    void registerWithEmail(formData);
                  } else if (authMode === "login") {
                    void signInWithEmail(formData);
                  } else if (authMode === "confirm") {
                    void confirmEmailOtp(formData);
                  } else if (authMode === "forgot") {
                    void requestPasswordReset(formData);
                  } else if (authMode === "reset") {
                    void resetPasswordWithOtp(formData);
                  } else {
                    void signInWithEmail(formData);
                  }
                }}
                className="grid gap-2"
              >
                {authMode === "confirm" ? (
                  <p className="rounded-xl border border-emerald-300/25 bg-emerald-400/10 p-3 text-sm font-bold leading-7 text-emerald-100">
                    أرسلنا رمز OTP إلى بريدك. أدخل الرمز لتفعيل الحساب والدخول مباشرة.
                  </p>
                ) : null}
                {authMode === "register" ? (
                  <>
                    <input
                      name="name"
                      required
                      value={authName}
                      onChange={(event) => setAuthName(event.target.value)}
                      placeholder="اسم الوسيط"
                      className={fieldClass()}
                    />
                    <input
                      name="phone"
                      required
                      value={authPhone}
                      onChange={(event) => setAuthPhone(event.target.value)}
                      placeholder="رقم الجوال"
                      className={fieldClass()}
                    />
                    <input
                      name="falLicense"
                      value={authFalLicense}
                      onChange={(event) => setAuthFalLicense(event.target.value)}
                      placeholder="رقم رخصة فال - اختياري"
                      className={fieldClass()}
                    />
                  </>
                ) : null}
                {authMode === "login" ? (
                  <input
                    name="identifier"
                    value={authIdentifier}
                    onChange={(event) => setAuthIdentifier(event.target.value)}
                    placeholder="البريد الإلكتروني / رقم الجوال"
                    className={fieldClass()}
                  />
                ) : (
                  <input
                    name="email"
                    type="email"
                    value={authEmail}
                    onChange={(event) => setAuthEmail(event.target.value)}
                    placeholder="البريد الإلكتروني"
                    className={fieldClass()}
                  />
                )}
                {authMode === "confirm" || authMode === "reset" ? (
                  <input
                    name="code"
                    inputMode="numeric"
                    value={authOtp}
                    onChange={(event) => setAuthOtp(event.target.value)}
                    placeholder="رمز OTP المكون من 6 أرقام"
                    className={fieldClass()}
                  />
                ) : null}
                {authMode === "login" || authMode === "register" ? (
                  <input
                    name="password"
                    type="password"
                    value={authPassword}
                    onChange={(event) => setAuthPassword(event.target.value)}
                    placeholder="كلمة المرور"
                    className={fieldClass()}
                  />
                ) : null}
                {authMode === "register" ? (
                  <input
                    name="passwordConfirm"
                    type="password"
                    value={authPasswordConfirm}
                    onChange={(event) => setAuthPasswordConfirm(event.target.value)}
                    placeholder="تأكيد كلمة المرور"
                    className={fieldClass()}
                  />
                ) : null}
                {authMode === "reset" ? (
                  <input
                    name="password"
                    type="password"
                    value={authNewPassword}
                    onChange={(event) => setAuthNewPassword(event.target.value)}
                    placeholder="كلمة المرور الجديدة"
                    className={fieldClass()}
                  />
                ) : null}
                <button type="submit" className="primary-button justify-center">
                  {authMode === "register"
                    ? "إنشاء حساب وإرسال OTP"
                    : authMode === "login"
                      ? "تسجيل الدخول"
                      : authMode === "confirm"
                        ? "تفعيل الحساب"
                        : authMode === "forgot"
                          ? "إرسال رمز الاستعادة"
                          : "تغيير كلمة المرور"}
                </button>
                {authMode === "login" ? (
                  <button type="button" onClick={() => setAuthMode("forgot")} className="text-right text-sm font-bold text-slate-300 hover:text-amber-200">
                    نسيت كلمة المرور؟
                  </button>
                ) : null}
                {authMode === "forgot" || authMode === "reset" ? (
                  <button type="button" onClick={() => setAuthMode("login")} className="secondary-button justify-center">
                    العودة لتسجيل الدخول
                  </button>
                ) : null}
                {authMode === "confirm" ? (
                  <button type="button" onClick={() => void resendConfirmationOtp()} className="secondary-button justify-center">
                    إعادة إرسال رمز التفعيل
                  </button>
                ) : null}
              </form>
            </>
          )}
          {authMessage ? <p className="rounded-xl border border-slate-600/25 bg-slate-950/25 p-3 text-sm font-bold leading-7 text-slate-200">{authMessage}</p> : null}
        </div>
      </Panel>
    );
  }

  function renderPublicAuthShell() {
    const visibleAuthMode = authMode === "register" || authMode === "confirm" ? "register" : "login";

    return (
      <main className="min-h-screen bg-[#071224] text-slate-50">
        <header className="border-b border-slate-700/40 bg-[#071224]/90 px-4 py-4 backdrop-blur lg:px-8">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="grid size-11 place-items-center rounded-xl gold-gradient shadow-lg">
                <Building2 className="size-6 text-[#0f1f3d]" strokeWidth={2.4} aria-hidden="true" />
              </div>
              <div>
                <p className="text-xs font-bold text-amber-300">مفكرة الوسيط</p>
                <h1 className="mt-1 text-2xl font-black text-white">إدارة الوساطة العقارية</h1>
              </div>
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => setAuthMode("login")} className={visibleAuthMode === "login" ? "primary-button" : "secondary-button"}>
                دخول
              </button>
              <button type="button" onClick={() => setAuthMode("register")} className={visibleAuthMode === "register" ? "primary-button" : "secondary-button"}>
                تسجيل
              </button>
            </div>
          </div>
        </header>
        <section className="mx-auto grid max-w-6xl gap-6 p-4 lg:grid-cols-[0.9fr_1.1fr] lg:p-8">
          <div className="relative overflow-hidden rounded-2xl border border-[#c9972f]/25 navy-gradient p-6 card-glow">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-1 gold-gradient opacity-90" />
            <p className="text-sm font-bold text-[#e5bc55]">نظام احترافي خاص بالوسطاء</p>
            <h2 className="mt-3 text-4xl font-black leading-tight text-white">سجل دخولك للوصول إلى بياناتك العقارية</h2>
            <p className="mt-4 leading-8 text-slate-300">
              كل حساب له عروضه وطلباته وعملاؤه وتذكيراته الخاصة. لا تظهر بيانات أي مستخدم قبل تسجيل الدخول.
            </p>
            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-slate-700/50 bg-[#172641]/55 p-4 card-glow">
                <p className="text-2xl font-black text-amber-200">خصوصية</p>
                <p className="mt-1 text-sm text-slate-400">بيانات كل وسيط منفصلة</p>
              </div>
              <div className="rounded-2xl border border-slate-700/50 bg-[#172641]/55 p-4 card-glow">
                <p className="text-2xl font-black text-emerald-200">AI</p>
                <p className="mt-1 text-sm text-slate-400">إدخال ذكي وسريع</p>
              </div>
              <div className="rounded-2xl border border-slate-700/50 bg-[#172641]/55 p-4 card-glow">
                <p className="text-2xl font-black text-sky-200">خرائط</p>
                <p className="mt-1 text-sm text-slate-400">مواقع وسجلات واضحة</p>
              </div>
            </div>
          </div>
          {renderAuthControls()}
        </section>
      </main>
    );
  }

  function renderBlockedAccountShell() {
    return (
      <main className="min-h-screen bg-slate-100 p-4 text-slate-950 lg:p-8">
        <div className="mx-auto max-w-2xl">
          <Panel title="تعذر تجهيز الحساب">
            <div className="grid gap-3">
              <p className="leading-8 text-slate-700">تم تسجيل الدخول، لكن لم نستطع تجهيز ملف الحساب أو تحميل بياناته.</p>
              {authMessage ? <p className="rounded-md bg-slate-100 p-3 text-sm font-bold leading-7 text-slate-700">{authMessage}</p> : null}
              <button type="button" onClick={signOut} className="secondary-button justify-center">
                تسجيل الخروج
              </button>
            </div>
          </Panel>
        </div>
      </main>
    );
  }

  function renderAdmin() {
    const monthlyPerformance = Array.from({ length: 6 }, (_, index) => {
      const date = new Date();
      date.setMonth(date.getMonth() - (5 - index), 1);
      const value = offers
        .filter((record) => {
          const created = new Date(record.createdAt);
          return created.getFullYear() === date.getFullYear() && created.getMonth() === date.getMonth();
        })
        .reduce((sum, record) => sum + (record.price ?? 0), 0);
      return { label: new Intl.DateTimeFormat("ar-SA", { month: "short" }).format(date), value };
    });
    const maxMonthlyValue = Math.max(...monthlyPerformance.map((item) => item.value), 1);
    const sectionContent: Record<ProfileSection, React.ReactNode> = {
      settings: (
        <section className="grid gap-4 xl:grid-cols-2">
          <Panel title="إعدادات الحساب">
            <div className="grid gap-3">
              <Info label="المستخدم" value={workspace.profile.name} />
              <Info label="الجوال" value={authUser?.phone ?? ""} />
              <Info label="البريد الإلكتروني" value={authUser?.email ?? ""} />
              <Info label="رقم الجوال للدخول" value={authUser?.phone || authUser?.username || ""} />
              <Info label="رخصة فال" value={authUser?.falLicense || "غير مضافة"} />
              <Info label="الدور" value={workspace.profile.role === "admin" ? "مدير" : "وسيط"} />
              <Info label="سياسة التسجيل" value="مفتوح لأي مستخدم" />
              <form
                className="grid gap-3 border-t border-slate-600/25 pt-3"
                onSubmit={(event) => {
                  event.preventDefault();
                  const form = event.currentTarget;
                  void (async () => {
                  const data = new FormData(form);
                  const days = Number(data.get("defaultReminderDays") || 14);
                  const timezone = String(data.get("timezone") || riyadhTimezone);
                  const name = String(data.get("name") || workspace.profile.name).trim();
                  const falLicense = String(data.get("falLicense") || "").trim();
                  const response = await fetch("/api/auth/profile", {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ name, falLicense, timezone }),
                  });
                  const body = await readJsonResponse<{ user: AuthUser; message?: string }>(response);
                  if (!response.ok || !body.user) {
                    addNotification("تعذر حفظ الملف", body.error ?? "لم يتم حفظ بيانات الملف الشخصي.", "warning");
                    return;
                  }
                  setAuthUser(body.user);
                  setWorkspace((current) => ({
                    ...current,
                    profile: {
                      ...current.profile,
                      name,
                      timezone,
                      defaultReminderDays: days > 0 ? days : 14,
                    },
                  }));
                  addNotification("تم حفظ الإعدادات", body.message ?? "تم تحديث بيانات الملف والإعدادات.", "success");
                  })();
                }}
              >
                <label className="grid gap-2 text-sm font-bold text-slate-300">اسم الوسيط<input name="name" defaultValue={authUser?.name || workspace.profile.name} className={fieldClass()} /></label>
                <label className="grid gap-2 text-sm font-bold text-slate-300">رخصة فال<input name="falLicense" defaultValue={authUser?.falLicense || ""} className={fieldClass()} /></label>
                <label className="grid gap-2 text-sm font-bold text-slate-300">المنطقة الزمنية<select name="timezone" defaultValue={workspace.profile.timezone} className={fieldClass()}><option value="Asia/Riyadh">Asia/Riyadh</option><option value="Asia/Beirut">Asia/Beirut</option><option value="Asia/Dubai">Asia/Dubai</option></select></label>
                <label className="grid gap-2 text-sm font-bold text-slate-300">مهلة التحديث الافتراضية بالأيام<input name="defaultReminderDays" type="number" min="1" defaultValue={workspace.profile.defaultReminderDays} className={fieldClass()} /></label>
                <button type="submit" className="primary-button justify-center">حفظ الإعدادات</button>
              </form>
            </div>
          </Panel>
          <Panel title="الأداء خلال 6 أشهر">
            <div className="flex h-64 items-end gap-3 rounded-2xl border border-slate-600/25 bg-slate-950/25 p-4">
              {monthlyPerformance.map((item) => (
                <div key={item.label} className="flex h-full flex-1 flex-col items-center justify-end gap-2">
                  <span className="text-[10px] font-bold text-slate-400">{item.value ? formatMoney(item.value) : "0"}</span>
                  <div className="w-full rounded-t-xl bg-gradient-to-t from-amber-400 to-emerald-300" style={{ height: `${Math.max((item.value / maxMonthlyValue) * 100, 4)}%` }} />
                  <span className="text-xs font-bold text-slate-400">{item.label}</span>
                </div>
              ))}
            </div>
            <p className="mt-3 text-sm leading-7 text-slate-400">القيم تمثل إجمالي قيمة العروض المضافة شهرياً، وتُحدّث تلقائياً من سجلات الحساب.</p>
          </Panel>
          <Panel title="خصوصية وربط النظام">
            <div className="grid gap-3 sm:grid-cols-2">
              <Info label="قاعدة البيانات" value={cloudStatus === "synced" ? "متصلة" : "تجري المزامنة"} />
              <Info label="البريد والإشعارات" value={workspace.profile.smtpReady ? "جاهز" : "يحتاج إعداداً"} />
            </div>
            <p className="mt-3 leading-8 text-slate-400">بيانات العروض والطلبات والعملاء والتذكيرات مرتبطة بحسابك فقط ولا تظهر لأي مستخدم آخر.</p>
          </Panel>
        </section>
      ),
      reminders: renderReminders(),
      notifications: renderNotifications(),
      sharing: renderSharing(),
      trash: renderTrash(),
    };

    return (
      <section className="grid gap-4">
        <div className="flex gap-2 overflow-x-auto rounded-2xl border border-slate-600/25 bg-[#0f1c34]/92 p-2 shadow-sm">
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
                  profileSection === item.id ? "bg-amber-300 text-slate-950" : "bg-slate-950/25 text-slate-300 hover:bg-slate-800 hover:text-white",
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

  if (!authReady) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#071224] p-4 text-white">
        <div className="rounded-2xl border border-[#c9972f]/25 bg-[#0f1f3d] p-6 text-center card-glow">
          <p className="font-black">جاري تجهيز الدخول الآمن...</p>
        </div>
      </main>
    );
  }

  if (!authUser) {
    return renderPublicAuthShell();
  }

  if (cloudStatus === "blocked") {
    return renderBlockedAccountShell();
  }

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#071224] text-slate-50">
      <div className="min-h-screen">
        <aside className="fixed right-0 top-0 z-40 hidden h-screen w-64 flex-col border-l border-slate-700/40 bg-[#0c1a36] md:flex">
          <div className="border-b border-slate-700/40 p-5">
            <div className="flex items-center gap-3">
              <div className="grid size-11 place-items-center rounded-xl gold-gradient shadow-lg">
                <Building2 className="size-6 text-[#0f1f3d]" strokeWidth={2.4} aria-hidden="true" />
              </div>
              <div>
                <h1 className="text-lg font-extrabold leading-tight text-white">مفكرة الوسيط</h1>
                <p className="text-xs font-semibold text-[#c9972f]">العقاري</p>
              </div>
            </div>
            <div className="mt-4 rounded-xl border border-slate-700/55 bg-[#172641]/60 p-3">
              <p className="text-sm font-bold text-white">{workspace.profile.name}</p>
              <p className="mt-0.5 text-xs text-slate-400">{authUser?.phone || authUser?.email}</p>
              <span className="mt-2 inline-flex rounded-full border border-[#c9972f]/30 bg-[#c9972f]/15 px-2 py-0.5 text-[11px] font-bold text-[#e5bc55]">
                وسيط نشط
              </span>
            </div>
            <button type="button" onClick={() => { setQuickKind("offer"); setQuickEntryMode("manual"); setQuickAddOpen(true); }} className="primary-button mt-4 w-full justify-center">
              <Plus className="size-5" aria-hidden="true" />
              إضافة عرض
            </button>
          </div>
          <nav className="flex-1 space-y-1 overflow-y-auto p-3 scrollbar-thin">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setView(item.id)}
                  className={[
                    "flex h-12 items-center gap-3 rounded-xl border px-3 text-sm font-semibold transition",
                    view === item.id ? "border-[#c9972f]/30 bg-[#c9972f]/15 text-[#e5bc55]" : "border-transparent text-slate-400 hover:bg-[#172641]/70 hover:text-white",
                  ].join(" ")}
                >
                  <Icon className="size-4" aria-hidden="true" />
                  {item.label}
                </button>
              );
            })}
          </nav>
        </aside>

        <div className="min-w-0 md:mr-64">
          <header className="sticky top-0 z-20 border-b border-slate-700/40 bg-[#071224]/90 px-4 py-4 backdrop-blur lg:px-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold text-[#c9972f]">مفكرة الوسيط</p>
                <h2 className="mt-1 text-2xl font-extrabold text-white md:text-3xl">{activeTitle}</h2>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button type="button" onClick={() => { setQuickEntryMode("whatsapp"); setQuickAddOpen(true); }} className="primary-button">
                  <Sparkles className="size-4" aria-hidden="true" />
                  إدخال AI
                </button>
                <button type="button" onClick={() => { setProfileSection("notifications"); setView("admin"); }} className="secondary-button" aria-label="الإشعارات">
                  <Bell className="size-4" aria-hidden="true" />
                  الإشعارات
                  {unreadNotifications > 0 ? <span className="rounded-full bg-amber-400 px-2 py-0.5 text-xs text-slate-950">{unreadNotifications}</span> : null}
                </button>
                <button type="button" onClick={signOut} className="secondary-button">
                  خروج
                </button>
              </div>
            </div>
          </header>
          <div className={view === "map" ? "pb-24 md:pb-0" : "mx-auto max-w-6xl p-4 pb-28 md:p-6"}>{renderContent()}</div>
        </div>
      </div>
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-700/40 bg-[#0c1a36]/95 pb-safe shadow-2xl backdrop-blur md:hidden" aria-label="التنقل الرئيسي للجوال">
        <div className="grid h-16 grid-cols-5">
          {navItems.filter((item) => item.id !== "clients").map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setView(item.id)}
                className={[
                  "relative flex flex-col items-center justify-center gap-0.5 text-[10px] font-bold transition",
                  view === item.id ? "text-[#e5bc55]" : "text-slate-400 hover:text-white",
                ].join(" ")}
              >
                {view === item.id ? <span className="absolute top-0 h-0.5 w-8 rounded-full bg-[#c9972f]" /> : null}
                <Icon className="size-5" aria-hidden="true" />
                <span>{item.label}</span>
                {item.id === "dashboard" && dueReminders > 0 ? <span className="absolute end-2 top-1 rounded-full bg-red-500 px-1.5 text-[10px] text-white">{dueReminders}</span> : null}
              </button>
            );
          })}
        </div>
      </nav>
      <button
        type="button"
        onClick={() => { setQuickEntryMode("manual"); setQuickAddOpen(true); }}
        className="fixed bottom-20 left-4 z-40 grid size-14 place-items-center rounded-full gold-gradient shadow-xl shadow-[#c9972f]/25 transition hover:-translate-y-1 md:bottom-5"
        aria-label="إضافة سريع"
      >
        <Plus className="size-7 text-[#0f1f3d]" strokeWidth={3} aria-hidden="true" />
      </button>
      {renderQuickAddModal()}
      {renderRecordDetailsModal()}
      {renderShareModal()}
    </main>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-700/50 bg-[#0f1f3d] p-4 card-glow">
      <h2 className="mb-4 text-lg font-extrabold text-white">{title}</h2>
      {children}
    </section>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-700/65 bg-[#0f1f3d]/55 p-8 text-center font-bold text-slate-400">
      {label}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="grid gap-2 text-sm font-bold text-slate-300">
      <span>{label}</span>
      {children}
    </label>
  );
}

function Info({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-slate-700/55 bg-[#172641]/45 p-3">
      <p className="text-xs font-bold text-slate-400">{label}</p>
      <p className="mt-1 font-extrabold text-white">{value}</p>
    </div>
  );
}

