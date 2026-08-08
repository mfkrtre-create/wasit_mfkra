import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("map page source", () => {
  it("does not include the old fake grid map fallback", () => {
    const pageSource = readFileSync(join(process.cwd(), "app", "page.tsx"), "utf8");

    expect(pageSource).not.toContain("خريطة تشغيلية أولية");
    expect(pageSource).not.toContain("bg-[linear-gradient");
    expect(pageSource).not.toContain("style={{ right:");
    expect(pageSource).toContain("RealEstateMap");
  });

  it("configures MapLibre with local worker and RTL Arabic text plugin", () => {
    const configSource = readFileSync(join(process.cwd(), "lib", "maplibre-config.ts"), "utf8");
    const mapSource = readFileSync(join(process.cwd(), "components", "RealEstateMap.tsx"), "utf8");
    const pickerSource = readFileSync(join(process.cwd(), "components", "LocationPicker.tsx"), "utf8");

    expect(configSource).toContain("/maplibre-gl-csp-worker.js");
    expect(configSource).toContain("/mapbox-gl-rtl-text.js");
    expect(configSource).toContain("setRTLTextPlugin");
    expect(configSource).toContain("getRTLTextPluginStatus");
    expect(mapSource).toContain("configureMapLibre");
    expect(pickerSource).toContain("configureMapLibre");
  });

  it("keeps AI and utility tools out of the primary sidebar navigation", () => {
    const pageSource = readFileSync(join(process.cwd(), "app", "page.tsx"), "utf8");
    const navBlock = pageSource.slice(pageSource.indexOf("const navItems"), pageSource.indexOf("const profileSections"));

    expect(navBlock).not.toContain('id: "ai"');
    expect(navBlock).not.toContain('id: "calculator"');
    expect(navBlock).not.toContain('id: "reminders"');
    expect(navBlock).not.toContain('id: "notifications"');
    expect(navBlock).not.toContain('id: "sharing"');
    expect(navBlock).not.toContain('id: "trash"');
    expect(navBlock).toContain('label: "الرئيسية"');
    expect(navBlock).toContain('label: "حسابي"');
    expect(pageSource).toContain('type ProfileSection = "settings" | "reminders" | "notifications" | "sharing" | "trash"');
    expect(pageSource).not.toContain('label: "الدخول والتسجيل"');
    expect(pageSource).toContain("تسجيل صوتي مباشر");
  });

  it("gates the app behind login and keeps production UI free of demo/debug state", () => {
    const pageSource = readFileSync(join(process.cwd(), "app", "page.tsx"), "utf8");

    expect(pageSource).toContain("return renderPublicAuthShell()");
    expect(pageSource).toContain("سجل الدخول أولاً للوصول إلى بياناتك");
    expect(pageSource).toContain('setWorkspace(seedState)');
    expect(pageSource).not.toContain("window.localStorage");
    expect(pageSource).not.toContain("wasit-mfkra-local-mvp-state");
    expect(pageSource).not.toContain("أبو خالد");
    expect(pageSource).not.toContain("شركة نجد");
    expect(pageSource).not.toContain("سارة العتيبي");
    expect(pageSource).not.toContain("SMTP جاهز");
    expect(pageSource).not.toContain("متغيرات Supabase");
    expect(pageSource).not.toContain("حالة قاعدة البيانات");
    expect(pageSource).not.toContain("غير مدعو");
    expect(pageSource).not.toContain("دعوات فقط");
    expect(pageSource).toContain("مفتوح لأي مستخدم");
  });

  it("protects AI server actions with authenticated requests", () => {
    const extractSource = readFileSync(join(process.cwd(), "app", "api", "extract-property", "route.ts"), "utf8");
    const transcribeSource = readFileSync(join(process.cwd(), "app", "api", "transcribe", "route.ts"), "utf8");
    const authSource = readFileSync(join(process.cwd(), "lib", "app-auth.ts"), "utf8");

    expect(extractSource).toContain("requireAuthenticatedRequest()");
    expect(transcribeSource).toContain("requireAuthenticatedRequest()");
    expect(authSource).toContain("app_sessions");
    expect(authSource).toContain("wasit_session");
    expect(authSource).toContain("سجل الدخول أولاً لاستخدام هذه الخدمة.");
  });

  it("uses server PostgreSQL auth and workspace tables", () => {
    const migrationSource = readFileSync(join(process.cwd(), "db", "migrations", "202608020001_server_auth.sql"), "utf8");
    const accountFieldsMigration = readFileSync(join(process.cwd(), "db", "migrations", "202608020003_account_fields_and_otp.sql"), "utf8");
    const migrateScript = readFileSync(join(process.cwd(), "scripts", "migrate.mjs"), "utf8");

    expect(migrationSource).toContain("create table if not exists public.app_users");
    expect(migrationSource).toContain("create table if not exists public.app_sessions");
    expect(migrationSource).toContain("create table if not exists public.workspace_snapshots");
    expect(accountFieldsMigration).toContain("fal_license");
    expect(accountFieldsMigration).toContain("username");
    expect(accountFieldsMigration).toContain("phone");
    expect(migrationSource).not.toContain("auth.uid()");
    expect(migrateScript).toContain("202608020001_server_auth.sql");
    expect(migrateScript).toContain("202608020003_account_fields_and_otp.sql");
  });

  it("implements public share snapshots with revocable /s token links", () => {
    const pageSource = readFileSync(join(process.cwd(), "app", "page.tsx"), "utf8");
    const shareApiSource = readFileSync(join(process.cwd(), "app", "api", "shares", "route.ts"), "utf8");
    const publicShareSource = readFileSync(join(process.cwd(), "app", "s", "[token]", "page.tsx"), "utf8");
    const migrationSource = readFileSync(join(process.cwd(), "db", "migrations", "202608020002_share_snapshots.sql"), "utf8");
    const migrateScript = readFileSync(join(process.cwd(), "scripts", "migrate.mjs"), "utf8");

    expect(pageSource).toContain("إنشاء رابط عام");
    expect(pageSource).toContain("بيانات الرابط العام");
    expect(shareApiSource).toContain("share_snapshots");
    expect(shareApiSource).toContain("/s/");
    expect(publicShareSource).toContain("مشاركة عقارية من مفكرة الوسيط");
    expect(migrationSource).toContain("create table if not exists public.share_snapshots");
    expect(migrationSource).toContain("revoked_at");
    expect(migrateScript).toContain("202608020002_share_snapshots.sql");
  });

  it("lets brokers edit AI results, saved records, and share text options", () => {
    const pageSource = readFileSync(join(process.cwd(), "app", "page.tsx"), "utf8");
    const extractRoute = readFileSync(join(process.cwd(), "app", "api", "extract-property", "route.ts"), "utf8");

    expect(pageSource).toContain("updateAiResult");
    expect(pageSource).toContain("راجع وعدّل البيانات قبل الحفظ");
    expect(pageSource).toContain("updateRecordFromForm");
    expect(pageSource).toContain("حفظ التعديل");
    expect(pageSource).toContain("resetAiEntry()");
    expect(pageSource).toContain("recordShareText(selectedShareRecord, publicShareOptions)");
    expect(pageSource).toContain("updatePublicShareOptions");
    expect(extractRoute).toContain("For short WhatsApp messages");
  });

  it("implements the approved broker workspace layout and advanced quick entry", () => {
    const pageSource = readFileSync(join(process.cwd(), "app", "page.tsx"), "utf8");

    expect(pageSource).toContain("إعلانات تجاوزت موعد تحديثها");
    expect(pageSource).toContain("مراسلة لتحديث العقار");
    expect(pageSource).toContain("سجل النشاط");
    expect(pageSource).toContain("أحدث الإعلانات");
    expect(pageSource).toContain("عمولة الشهر");
    expect(pageSource).toContain("إدخال يدوي");
    expect(pageSource).toContain("لصق واتساب");
    expect(pageSource).toContain("إدخال صوتي");
    expect(pageSource).toContain('name="askingPrice"');
    expect(pageSource).toContain('name="basePriceMode"');
    expect(pageSource).toContain('name="facades"');
    expect(pageSource).toContain('name="planNumber"');
    expect(pageSource).toContain('name="blockNumber"');
    expect(pageSource).toContain('name="plotNumber"');
    expect(pageSource).toContain('name="reminderDays"');
    expect(pageSource).toContain("سجل المتابعة");
    expect(pageSource).toContain("الأداء خلال 6 أشهر");
  });

  it("implements mobile bottom navigation, notification bell, details modal, and same-page share modal", () => {
    const pageSource = readFileSync(join(process.cwd(), "app", "page.tsx"), "utf8");
    const mapSource = readFileSync(join(process.cwd(), "components", "RealEstateMap.tsx"), "utf8");

    expect(pageSource).toContain('aria-label="التنقل الرئيسي للجوال"');
    expect(pageSource).toContain("pb-safe");
    expect(pageSource).toContain("border-t border-slate-700/40 p-4");
    expect(pageSource).toContain("إضافة سريعة");
    expect(pageSource).not.toContain('aria-label="الإشعارات"');
    expect(pageSource).toContain("renderRecordDetailsModal");
    expect(pageSource).toContain("setShareModalOpen(true)");
    expect(pageSource).toContain("مشاركة من نفس الصفحة");
    expect(mapSource).toContain("onOpenDetails(properties.id)");
  });

  it("keeps property images behind authenticated API routes and out of base64 database fields", () => {
    const pageSource = readFileSync(join(process.cwd(), "app", "page.tsx"), "utf8");
    const imageApi = readFileSync(join(process.cwd(), "app", "api", "property-images", "route.ts"), "utf8");
    const imageGetApi = readFileSync(join(process.cwd(), "app", "api", "property-images", "[id]", "route.ts"), "utf8");

    expect(pageSource).toContain("quickImages");
    expect(pageSource).toContain("/api/property-images");
    expect(imageApi).toContain("requireAuthenticatedRequest()");
    expect(imageApi).toContain("5 * 1024 * 1024");
    expect(imageGetApi).toContain("startsWith(`${user.id}_`)");
    expect(pageSource).not.toContain("readAsDataURL");
  });

  it("supports OTP email activation and password recovery UI", () => {
    const pageSource = readFileSync(join(process.cwd(), "app", "page.tsx"), "utf8");
    const registerRoute = readFileSync(join(process.cwd(), "app", "api", "auth", "register", "route.ts"), "utf8");
    const confirmRoute = readFileSync(join(process.cwd(), "app", "api", "auth", "confirm-email", "route.ts"), "utf8");
    const resetRoute = readFileSync(join(process.cwd(), "app", "api", "auth", "reset-password", "route.ts"), "utf8");

    expect(pageSource).toContain("رقم الجوال");
    expect(pageSource).toContain("رقم رخصة فال");
    expect(pageSource).toContain("تأكيد كلمة المرور");
    expect(pageSource).not.toContain("اسم مستخدم اختياري");
    expect(registerRoute).toContain("const username = phone");
    expect(pageSource).toContain("رمز OTP");
    expect(pageSource).toContain("استعادة كلمة المرور");
    expect(confirmRoute).toContain("email_confirm");
    expect(resetRoute).toContain("password_reset");
  });

  it("saves permitted profile fields through an authenticated server route", () => {
    const pageSource = readFileSync(join(process.cwd(), "app", "page.tsx"), "utf8");
    const profileRoute = readFileSync(join(process.cwd(), "app", "api", "auth", "profile", "route.ts"), "utf8");

    expect(pageSource).toContain("/api/auth/profile");
    expect(pageSource).toContain('name="falLicense"');
    expect(profileRoute).toContain("requireAuthenticatedRequest()");
    expect(profileRoute).toContain("set name = $2, fal_license = $3, timezone = $4");
    expect(profileRoute).not.toContain("phone =");
    expect(profileRoute).not.toContain("email =");
  });
});
