import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = (...parts: string[]) => readFileSync(join(process.cwd(), ...parts), 'utf8');

describe('reference frontend integration', () => {
  it('mounts the complete reference app after authenticated workspace loading', () => {
    const page = source('app', 'page.tsx');
    expect(page).toContain("fetch('/api/auth/session'");
    expect(page).toContain("fetch('/api/workspace'");
    expect(page).toContain('initializeDB(workspace.state, session.user)');
    expect(page).toContain('return <ReferenceApp />');
    expect(page).not.toContain('localStorage');
  });

  it('uses the reference desktop sidebar and mobile navigation', () => {
    const layout = source('ui', 'components', 'Layout.tsx');
    expect(layout).toContain('fixed top-0 right-0 h-screen w-64');
    expect(layout).toContain("bg-[#0c1a36]");
    expect(layout).toContain('md:mr-64 min-h-screen');
    expect(layout).toContain('md:hidden fixed bottom-0');
    expect(layout).toContain('إضافة سريعة');
  });

  it('uses the full reference navigation modules', () => {
    const layout = source('ui', 'components', 'Layout.tsx');
    for (const label of ['الرئيسية', 'العروض', 'الطلبات', 'الخريطة', 'العملاء', 'حسابي']) {
      expect(layout).toContain(label);
    }
  });

  it('uses the complete reference dashboard', () => {
    const dashboard = source('ui', 'pages', 'Dashboard.tsx');
    expect(dashboard).toContain('إعلانات تجاوزت موعد تحديثها');
    expect(dashboard).toContain('مراسلة لتحديث العقار');
    expect(dashboard).toContain('سجل النشاط');
    expect(dashboard).toContain('أحدث الإعلانات');
    expect(dashboard).toContain('عمولة الشهر');
  });

  it('uses the reference listings tabs, search, and cards', () => {
    const listings = source('ui', 'pages', 'ListingsPage.tsx');
    const card = source('ui', 'components', 'ListingCard.tsx');
    expect(listings).toContain('allStatuses(kind)');
    expect(listings).toContain('بحث ذكي:');
    expect(listings).toContain('<ListingCard');
    expect(card).toContain('مراسلة لتحديث العقار');
    expect(card).toContain('مشاركة');
  });

  it('uses the reference details sheet, sharing, and archive dialogs', () => {
    const details = source('ui', 'components', 'ListingDetails.tsx');
    expect(details).toContain('<ShareDialog');
    expect(details).toContain('<ArchiveDialog');
    expect(details).toContain('سجل المشاركات');
    expect(details).toContain('استعادة العقار نشط');
  });

  it('uses the reference three-mode quick add and review workflow', () => {
    const quickAdd = source('ui', 'components', 'quick-add', 'QuickAddModal.tsx');
    const editor = source('ui', 'components', 'quick-add', 'DraftEditor.tsx');
    expect(quickAdd).toContain('إدخال يدوي');
    expect(quickAdd).toContain('لصق واتساب');
    expect(quickAdd).toContain('إدخال صوتي');
    expect(quickAdd).toContain('مراجعة قبل الحفظ');
    expect(quickAdd).toContain('db.addListing');
    expect(quickAdd).toContain('extractPropertyWithServerAI');
    expect(quickAdd).toContain('transcribeWithServerAI');
    expect(editor).toContain('/api/property-images');
  });

  it('uses the reference dynamic property fields and mandatory map picker', () => {
    const editor = source('ui', 'components', 'quick-add', 'DraftEditor.tsx');
    expect(editor).toContain('TYPE_FIELDS[draft.propertyType]');
    expect(editor).toContain('موقع العقار على الخريطة');
    expect(editor).toContain('* إلزامي');
    expect(editor).toContain('<MapPicker');
  });

  it('uses the reference MapLibre OpenFreeMap map and listing panel', () => {
    const map = source('ui', 'pages', 'MapPage.tsx');
    expect(map).toContain("import('maplibre-gl')");
    expect(map).toContain('tiles.openfreemap.org/styles/liberty');
    expect(map).toContain('خريطة الإعلانات');
    expect(map).toContain('قائمة الإعلانات');
  });

  it('uses the reference contacts and account pages', () => {
    const contacts = source('ui', 'pages', 'ContactsPage.tsx');
    const account = source('ui', 'pages', 'AccountPage.tsx');
    expect(contacts).toContain('السجل الزمني للمشاركات');
    expect(contacts).toContain('مراسلة واتساب');
    expect(account).toContain('إحصائيات الأداء والصفقات');
    expect(account).toContain('رخصة فال');
  });

  it('persists reference mutations through the authenticated backend workspace', () => {
    const adapter = source('ui', 'lib', 'db.ts');
    expect(adapter).toContain("fetch('/api/workspace'");
    expect(adapter).toContain("method: 'PUT'");
    expect(adapter).toContain('records: state.listings.map');
    expect(adapter).toContain('images: listing.images');
    expect(adapter).not.toContain('localStorage');
  });

  it('restores public share links while keeping requirement documents out of the product UI', () => {
    const app = source('ui', 'App.tsx');
    const layout = source('ui', 'components', 'Layout.tsx');
    const shareDialog = source('ui', 'components', 'ShareDialog.tsx');
    expect(app).not.toContain('DocumentsPage');
    expect(layout).not.toContain('/documents');
    expect(shareDialog).toContain('createPublicShare');
    expect(shareDialog).toContain('revokePublicShare');
    expect(existsSync(join(process.cwd(), 'documents'))).toBe(true);
    expect(existsSync(join(process.cwd(), 'ui', 'pages', 'DocumentsPage.tsx'))).toBe(false);
    expect(existsSync(join(process.cwd(), 'app', 'api', 'documents', 'route.ts'))).toBe(false);
  });

  it('keeps AI and image server actions authenticated', () => {
    const extract = source('app', 'api', 'extract-property', 'route.ts');
    const transcribe = source('app', 'api', 'transcribe', 'route.ts');
    const images = source('app', 'api', 'property-images', 'route.ts');
    expect(extract).toContain('requireAuthenticatedRequest()');
    expect(transcribe).toContain('requireAuthenticatedRequest()');
    expect(images).toContain('requireAuthenticatedRequest()');
  });

  it('supports production OTP authentication and protected profile updates', () => {
    const page = source('app', 'page.tsx');
    const profile = source('app', 'api', 'auth', 'profile', 'route.ts');
    expect(page).toContain('رمز OTP');
    expect(page).toContain('استعادة كلمة المرور');
    expect(page).toContain('رخصة فال');
    expect(profile).toContain('requireAuthenticatedRequest()');
    expect(profile).toContain('phone =');
    expect(profile).not.toContain('email =');
  });

  it('grounds Saudi-dialect AI extraction in the production schema', () => {
    const extract = source('app', 'api', 'extract-property', 'route.ts');
    const schema = source('lib', 'property-schema.ts');
    expect(extract).toContain('SYSTEM_INSTRUCTION');
    expect(extract).toContain('Saudi broker dialect');
    expect(extract).toContain('Never infer');
    expect(schema).toContain('technicalRequirements');
    expect(schema).toContain('minimumArea');
    expect(schema).toContain('maximumArea');
  });
});
