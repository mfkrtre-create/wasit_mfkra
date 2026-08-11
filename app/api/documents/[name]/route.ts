import { readFile, stat } from "node:fs/promises";
import { basename, join } from "node:path";
import { NextResponse } from "next/server";
import { requireAuthenticatedRequest } from "@/lib/app-auth";

export const runtime = "nodejs";

const documentsRoot = join(process.cwd(), "documents");
const contentTypes: Record<string, string> = {
  ".txt": "text/plain; charset=utf-8",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

function extensionFor(name: string) {
  const match = name.match(/(\.[^.]+)$/);
  return match?.[1]?.toLowerCase() ?? "";
}

export async function GET(_request: Request, { params }: { params: Promise<{ name: string }> }) {
  const { response } = await requireAuthenticatedRequest();
  if (response) return response;

  const { name } = await params;
  const decodedName = decodeURIComponent(name);
  const safeName = basename(decodedName);
  if (safeName !== decodedName) {
    return NextResponse.json({ error: "اسم الملف غير صحيح." }, { status: 400 });
  }

  const extension = extensionFor(safeName);
  if (!contentTypes[extension]) {
    return NextResponse.json({ error: "نوع الملف غير مدعوم." }, { status: 404 });
  }

  const filePath = join(documentsRoot, safeName);
  const fileStat = await stat(filePath).catch(() => null);
  if (!fileStat?.isFile()) {
    return NextResponse.json({ error: "الملف غير موجود." }, { status: 404 });
  }

  const file = await readFile(filePath);
  return new Response(file, {
    headers: {
      "Content-Type": contentTypes[extension],
      "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(safeName)}`,
      "Cache-Control": "private, max-age=300",
    },
  });
}
