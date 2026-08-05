import { randomBytes } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { NextResponse } from "next/server";
import { requireAuthenticatedRequest } from "@/lib/app-auth";

export const runtime = "nodejs";

const maxImageBytes = 5 * 1024 * 1024;
const allowedTypes = new Map([
  ["image/jpeg", ".jpg"],
  ["image/png", ".png"],
  ["image/webp", ".webp"],
]);

function imageRoot() {
  return process.env.PROPERTY_IMAGE_DIR || join(process.cwd(), ".data", "property-images");
}

export async function POST(request: Request) {
  const { user, response } = await requireAuthenticatedRequest();
  if (response || !user) {
    return response;
  }

  const formData = await request.formData().catch(() => null);
  const file = formData?.get("image");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "اختر صورة صحيحة أولاً." }, { status: 400 });
  }

  const extension = allowedTypes.get(file.type);
  if (!extension) {
    return NextResponse.json({ error: "نوع الصورة غير مدعوم. استخدم JPG أو PNG أو WebP." }, { status: 400 });
  }

  if (file.size <= 0 || file.size > maxImageBytes) {
    return NextResponse.json({ error: "حجم الصورة يجب ألا يتجاوز 5MB." }, { status: 400 });
  }

  const originalExtension = extname(file.name).toLowerCase();
  const safeExtension = allowedTypes.has(file.type) ? extension : originalExtension;
  const token = randomBytes(16).toString("hex");
  const id = `${user.id}_${token}${safeExtension}`;
  const directory = imageRoot();
  await mkdir(directory, { recursive: true });
  await writeFile(join(directory, id), Buffer.from(await file.arrayBuffer()));

  return NextResponse.json({
    image: {
      id,
      url: `/api/property-images/${encodeURIComponent(id)}`,
      name: file.name,
      main: false,
    },
  });
}
