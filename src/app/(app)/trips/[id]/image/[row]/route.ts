import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sheetImage } from "@/lib/xlsx-view";

// Serves an embedded image from a trip workbook sheet row — same pattern as
// the price-list file image route, with an in-process buffer cache.
const bufferCache = new Map<string, Promise<Buffer>>();
const CACHE_MAX = 3;

async function getTripBuffer(tripId: string, storagePath: string): Promise<Buffer> {
  const cached = bufferCache.get(tripId);
  if (cached) return cached;

  const promise = (async () => {
    const supabase = await createClient();
    const { data, error } = await supabase.storage
      .from("price-lists")
      .download(storagePath);
    if (error || !data) throw new Error(error?.message ?? "download failed");
    return Buffer.from(await data.arrayBuffer());
  })();

  bufferCache.set(tripId, promise);
  promise.catch(() => bufferCache.delete(tripId));
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

  const { data: trip } = await supabase
    .from("trips")
    .select("id, storage_path")
    .eq("id", id)
    .single();
  if (!trip) return NextResponse.json({ error: "not found" }, { status: 404 });

  try {
    const buffer = await getTripBuffer(trip.id, trip.storage_path);
    const img = sheetImage(buffer, sheet, rowNum);
    if (!img) return NextResponse.json({ error: "no image" }, { status: 404 });

    return new NextResponse(new Uint8Array(img.data), {
      headers: {
        "Content-Type": img.contentType,
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
