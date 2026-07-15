import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sheetImage } from "@/lib/xlsx-view";

// Serves the embedded product image anchored on one worksheet row.
// The workbook buffer is cached in-process so a page of 100 <img> tags
// doesn't re-download the ~15MB file from Storage 100 times.
const bufferCache = new Map<string, Promise<Buffer>>();
const CACHE_MAX = 3;

async function getFileBuffer(
  fileId: string,
  storagePath: string
): Promise<Buffer> {
  const cached = bufferCache.get(fileId);
  if (cached) return cached;

  const promise = (async () => {
    const supabase = await createClient();
    const { data, error } = await supabase.storage
      .from("price-lists")
      .download(storagePath);
    if (error || !data) throw new Error(error?.message ?? "download failed");
    return Buffer.from(await data.arrayBuffer());
  })();

  bufferCache.set(fileId, promise);
  promise.catch(() => bufferCache.delete(fileId)); // don't cache failures
  if (bufferCache.size > CACHE_MAX) {
    const oldest = bufferCache.keys().next().value;
    if (oldest) bufferCache.delete(oldest);
  }
  return promise;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; row: string }> }
) {
  const { id, row } = await params;
  const sheet = Number(request.nextUrl.searchParams.get("sheet") ?? 0) || 0;
  const rowNum = Number(row);
  if (!Number.isInteger(rowNum) || rowNum < 1) {
    return NextResponse.json({ error: "bad row" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data: file } = await supabase
    .from("price_list_files")
    .select("id, storage_path")
    .eq("id", id)
    .single();
  if (!file) return NextResponse.json({ error: "not found" }, { status: 404 });

  try {
    const buffer = await getFileBuffer(file.id, file.storage_path);
    const img = sheetImage(buffer, sheet, rowNum);
    if (!img) return NextResponse.json({ error: "no image" }, { status: 404 });

    return new NextResponse(new Uint8Array(img.data), {
      headers: {
        "Content-Type": img.contentType,
        // Uploaded files are immutable (new upload = new id), so cache hard.
        "Cache-Control": "private, max-age=86400, immutable",
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "failed" },
      { status: 500 }
    );
  }
}
