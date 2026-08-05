import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuthenticatedRequest } from "@/lib/app-auth";
import { getDb } from "@/lib/db";

export const runtime = "nodejs";

const schema = z.object({
  name: z.string().trim().min(1).max(120),
  falLicense: z.string().trim().max(80).optional().or(z.literal("")),
  timezone: z.string().trim().min(1).max(80).default("Asia/Riyadh"),
});

export async function PUT(request: Request) {
  const { user, response } = await requireAuthenticatedRequest();
  if (response || !user) {
    return response;
  }

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "بيانات الملف الشخصي غير صحيحة." }, { status: 400 });
  }

  const result = await getDb().query(
    `
      update app_users
      set name = $2, fal_license = $3, timezone = $4
      where id = $1
      returning id, email, username, phone, name, role, timezone, fal_license, email_confirmed_at
    `,
    [user.id, parsed.data.name, parsed.data.falLicense || "", parsed.data.timezone],
  );

  const row = result.rows[0];
  return NextResponse.json({
    user: {
      id: String(row.id),
      email: String(row.email),
      username: String(row.username || row.phone || row.email),
      phone: String(row.phone || ""),
      name: String(row.name || "وسيط عقاري"),
      role: row.role === "admin" ? "admin" : "broker",
      timezone: String(row.timezone || "Asia/Riyadh"),
      falLicense: String(row.fal_license || ""),
      emailConfirmed: Boolean(row.email_confirmed_at),
    },
    message: "تم حفظ بيانات الملف الشخصي.",
  });
}
