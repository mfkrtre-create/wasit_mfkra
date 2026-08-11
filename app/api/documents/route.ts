import { readdir, readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import { NextResponse } from "next/server";
import { requireAuthenticatedRequest } from "@/lib/app-auth";

export const runtime = "nodejs";

const documentsRoot = join(process.cwd(), "documents");
const allowedExtensions = new Set([".txt", ".docx"]);

function extensionFor(name: string) {
  const match = name.match(/(\.[^.]+)$/);
  return match?.[1]?.toLowerCase() ?? "";
}

export async function GET() {
  const { response } = await requireAuthenticatedRequest();
  if (response) return response;

  const names = await readdir(documentsRoot).catch(() => []);
  const documents = await Promise.all(
    names
      .filter((name) => allowedExtensions.has(extensionFor(name)))
      .map(async (name) => {
        const filePath = join(documentsRoot, name);
        const fileStat = await stat(filePath);
        const isText = extensionFor(name) === ".txt";
        return {
          name,
          size: fileStat.size,
          type: isText ? "txt" : "docx",
          url: `/api/documents/${encodeURIComponent(name)}`,
          content: isText ? await readFile(filePath, "utf8") : null,
        };
      }),
  );

  return NextResponse.json({ documents });
}
