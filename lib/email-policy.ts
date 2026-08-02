const blockedProductionDomains = new Set([
  "example.com",
  "example.net",
  "example.org",
  "test.com",
  "invalid",
  "localhost",
  "local.test",
]);

const placeholderLocalParts = new Set(["test", "demo", "example", "placeholder", "fake", "user", "admin"]);

export class InvalidProductionEmailError extends Error {
  constructor(message = "استخدم بريداً إلكترونياً حقيقياً لاستلام رمز OTP.") {
    super(message);
    this.name = "InvalidProductionEmailError";
  }
}

export function normalizeEmailAddress(email: string) {
  return email.trim().toLowerCase();
}

export function getEmailDomain(email: string) {
  const normalized = normalizeEmailAddress(email);
  const domain = normalized.split("@")[1]?.trim() ?? "";
  return domain;
}

export function isLocalOrTestEmailMode() {
  return process.env.NODE_ENV === "test" || process.env.SMTP_MOCK_MODE === "true" || process.env.ALLOW_TEST_EMAIL_RECIPIENTS === "true";
}

export function isPlaceholderEmail(email: string) {
  const normalized = normalizeEmailAddress(email);
  const [localPart, domain] = normalized.split("@");
  if (!localPart || !domain) {
    return true;
  }

  if (blockedProductionDomains.has(domain)) {
    return true;
  }

  if (localPart.startsWith("otp-test-") || localPart.startsWith("test-") || localPart.endsWith("-test")) {
    return true;
  }

  return placeholderLocalParts.has(localPart);
}

export function assertOtpRecipientAllowed(email: string) {
  const normalized = normalizeEmailAddress(email);
  if (!isLocalOrTestEmailMode() && isPlaceholderEmail(normalized)) {
    throw new InvalidProductionEmailError();
  }

  return normalized;
}
