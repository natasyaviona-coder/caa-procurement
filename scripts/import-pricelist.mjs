// =============================================================================
// CAA Procurement — supplier price-list importer  (LOCAL, run-once but reusable)
//
// Pulls product photos + row data out of supplier .xlsx files and loads them
// into Supabase: uploads each image to the `product-photos` storage bucket and
// upserts products.photo_url (+ name/spec). Optionally records the RMB price as
// a supplier_quote when --supplier is given, tagged with which file it came
// from (source_file) so it's filterable later. See CLAUDE.md sections 6 & 10.
//
// Translation is a separate step (the pricelisttranslate Claude skill) — this
// script does not translate Chinese text. Point it at the already-translated
// English .xlsx output.
//
// SAFE BY DEFAULT: without --commit it only prints a report (images found /
// matched to a SKU / unmatched) per file and writes NOTHING. Review the
// report, then re-run with --commit.
//
// Usage:
//   1. cd scripts && npm install
//   2. Ensure ../.env.local has NEXT_PUBLIC_SUPABASE_URL and
//      SUPABASE_SERVICE_ROLE_KEY (service role — this script bypasses RLS to
//      bulk-write; that key belongs only in local scripts, never in the app).
//   3. One file:   node import-pricelist.mjs --file "/path/to/PriceList.xlsx"
//   4. Many files: node import-pricelist.mjs --dir "/path/to/folder"
//                  (processes every .xlsx directly inside the folder — point
//                  this at a folder that only has price lists in it, or any
//                  unrelated .xlsx will just show up as "skipped" in the report)
//   5. Commit:     add --commit to either form
//   6. With quotes: add --supplier <supplier-uuid>
//
// Column mapping defaults to the FEI/translated-price-list layout. Override per
// run with --col-sku B --col-name D --col-rmb C --col-qty F etc. if a supplier
// uses a different sheet — one mapping applies to every file in the run.
// =============================================================================

import { readFileSync, existsSync, readdirSync } from "node:fs";
import { dirname, resolve, basename, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { readPriceList } from "./xlsx-parse.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));

// ---------------------------------------------------------------- args --------
function parseArgs(argv) {
  const args = { commit: false, headerRows: 1, col: {}, files: [] };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    const next = () => argv[++i];
    switch (a) {
      case "--file": args.files.push(next()); break;
      case "--dir": args.dir = next(); break;
      case "--supplier": args.supplier = next(); break;
      case "--commit": args.commit = true; break;
      case "--header-rows": args.headerRows = Number(next()); break;
      case "--bucket": args.bucket = next(); break;
      case "--col-sku": args.col.sku = next(); break;
      case "--col-name": args.col.name = next(); break;
      case "--col-rmb": args.col.rmb = next(); break;
      case "--col-qty": args.col.qty = next(); break;
      case "--col-size": args.col.size = next(); break;
      case "--col-color": args.col.color = next(); break;
      default:
        console.error(`Unknown argument: ${a}`);
        process.exit(1);
    }
  }
  return args;
}

// Default column mapping (FEI / pricelisttranslate layout).
const DEFAULT_COLS = {
  sku: "B",   // Item No. / model
  name: "D",  // Product Name
  rmb: "C",   // Unit Price (RMB)
  qty: "F",   // Qty per Carton
  size: "E",  // Size (cm)
  color: "H", // Color
};

const BUCKET = "product-photos";

// ---------------------------------------------------------------- env ---------
function loadEnv() {
  const envPath = resolve(__dirname, "..", ".env.local");
  if (!existsSync(envPath)) {
    console.error("Missing ../.env.local — cannot find Supabase credentials.");
    process.exit(1);
  }
  const env = {};
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url) {
    console.error("NEXT_PUBLIC_SUPABASE_URL not set in ../.env.local");
    process.exit(1);
  }
  return { url, serviceKey };
}

// ---------------------------------------------------------------- helpers -----
function cleanText(v) {
  if (v == null) return null;
  const s = String(v).replace(/\s+/g, " ").trim();
  return s || null;
}

function parseRmb(v) {
  if (v == null) return null;
  const n = Number(String(v).replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) && n > 0 ? n : null;
}

function parseIntOrNull(v) {
  if (v == null) return null;
  const n = Number(String(v).replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

const contentType = (ext) =>
  ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg";

// SKU -> safe storage object key.
function skuToKey(sku, ext) {
  const safe = sku.replace(/[^a-zA-Z0-9._-]/g, "_");
  return `${safe}.${ext === "png" ? "png" : ext === "webp" ? "webp" : "jpg"}`;
}

// Parse one file into row records tagged with which file they came from.
// Returns { skipped: true, reason } instead of throwing, so one bad file in a
// --dir batch (e.g. a ledger or stats export, not a price list) doesn't take
// down the whole run.
function processFile(filePath, cols, headerRows) {
  const sourceFile = basename(filePath);
  let parsed;
  try {
    parsed = readPriceList(filePath);
  } catch (err) {
    return { sourceFile, skipped: true, reason: err.message };
  }
  const { rows, sheetName } = parsed;
  const dataRows = rows.filter((r) => r.rowNum > headerRows);

  const records = [];
  let imagesFound = 0;
  for (const r of dataRows) {
    const sku = cleanText(r.cells.get(cols.sku));
    const name = cleanText(r.cells.get(cols.name));
    const rmb = parseRmb(r.cells.get(cols.rmb));
    const qty = parseIntOrNull(r.cells.get(cols.qty));
    const size = cleanText(r.cells.get(cols.size));
    const color = cleanText(r.cells.get(cols.color));
    if (r.image) imagesFound++;

    if (!sku && !name && !r.image) continue;

    const specParts = [];
    if (size) specParts.push(`Size: ${size}`);
    if (color) specParts.push(`Color: ${color}`);

    records.push({
      sourceFile,
      rowNum: r.rowNum,
      sku,
      name,
      rmb,
      moq: qty,
      spec_summary: specParts.join(" · ") || null,
      image: r.image,
    });
  }

  return { sourceFile, sheetName, records, imagesFound, skipped: false };
}

function printFileReport(result) {
  if (result.skipped) {
    console.log(`\n─── ${result.sourceFile} ───  SKIPPED (not a price-list sheet)`);
    console.log(`  Reason: ${result.reason}`);
    return;
  }
  const { sourceFile, sheetName, records, imagesFound } = result;
  const matched = records.filter((r) => r.sku && r.image);
  const unmatchedImages = records.filter((r) => r.image && !r.sku);
  const noImage = records.filter((r) => r.sku && !r.image);

  console.log(`\n─── ${sourceFile} ───  (sheet "${sheetName}")`);
  console.log(`  Data rows parsed:          ${records.length}`);
  console.log(`  Images found:              ${imagesFound}`);
  console.log(`  Images matched to a SKU:   ${matched.length}`);
  console.log(`  Rows with SKU, no image:   ${noImage.length}`);
  console.log(`  Images with NO SKU (⚠):    ${unmatchedImages.length}`);

  if (unmatchedImages.length > 0) {
    console.log(`  ⚠  Unmatched (need a manual look):`);
    for (const r of unmatchedImages.slice(0, 10)) {
      console.log(`     row ${r.rowNum}: image=${r.image.name} name=${r.name ?? "—"}`);
    }
    if (unmatchedImages.length > 10) {
      console.log(`     …and ${unmatchedImages.length - 10} more`);
    }
  }

  // Per-file sample so a folder that swept up a non-price-list file (a bank
  // statement, a ROIC calc — anything with text sitting in the right columns
  // by coincidence) is obvious to spot before --commit, not buried under a
  // global sample that might only ever show the first file's rows.
  const withSku = records.filter((r) => r.sku);
  if (withSku.length > 0) {
    console.log(`  Sample rows that WILL be upserted:`);
    for (const r of withSku.slice(0, 3)) {
      console.log(
        `     ${r.sku}  ·  ${r.name ?? "—"}  ·  ${r.rmb ? `¥${r.rmb}` : "no price"}  ·  ${
          r.image ? "has photo" : "no photo"
        }`
      );
    }
    console.log(`     Does this look like product data? If not, exclude this file.`);
  }
}

// ---------------------------------------------------------------- main --------
async function main() {
  const args = parseArgs(process.argv);

  let filePaths = [...args.files];
  if (args.dir) {
    if (!existsSync(args.dir)) {
      console.error(`Directory not found: ${args.dir}`);
      process.exit(1);
    }
    const found = readdirSync(args.dir).filter((f) => f.toLowerCase().endsWith(".xlsx"));
    filePaths.push(...found.map((f) => join(args.dir, f)));
  }
  if (filePaths.length === 0) {
    console.error(
      'Required: --file "/path/to/PriceList.xlsx" (repeatable) or --dir "/path/to/folder"'
    );
    process.exit(1);
  }
  for (const f of filePaths) {
    if (!existsSync(f)) {
      console.error(`File not found: ${f}`);
      process.exit(1);
    }
  }

  const cols = { ...DEFAULT_COLS, ...args.col };
  const bucket = args.bucket ?? BUCKET;

  console.log(`\nProcessing ${filePaths.length} file(s)…`);
  const fileResults = filePaths.map((f) => processFile(f, cols, args.headerRows));
  fileResults.forEach(printFileReport);

  const skippedFiles = fileResults.filter((f) => f.skipped);
  const allRecords = fileResults.flatMap((f) => f.records ?? []);
  const totalImages = fileResults.reduce((s, f) => s + (f.imagesFound ?? 0), 0);
  const totalMatched = allRecords.filter((r) => r.sku && r.image).length;
  const totalUnmatched = allRecords.filter((r) => r.image && !r.sku).length;

  console.log("\n──────────── TOTAL ────────────");
  console.log(`Files processed:           ${filePaths.length - skippedFiles.length}`);
  if (skippedFiles.length > 0) {
    console.log(`Files skipped (not a price list): ${skippedFiles.length}`);
  }
  console.log(`Data rows parsed:          ${allRecords.length}`);
  console.log(`Images found:              ${totalImages}`);
  console.log(`Images matched to a SKU:   ${totalMatched}`);
  console.log(`Images with NO SKU (⚠):    ${totalUnmatched}`);

  console.log("\nSample of what WILL be upserted (first 8, across all files):");
  for (const r of allRecords.filter((r) => r.sku).slice(0, 8)) {
    console.log(
      `   [${r.sourceFile}] ${r.sku}  ·  ${r.name ?? "—"}  ·  ${
        r.rmb ? `¥${r.rmb}` : "no price"
      }  ·  ${r.image ? "has photo" : "no photo"}`
    );
  }

  if (!args.commit) {
    console.log(
      "\nDRY RUN — nothing written. Re-run with --commit to upload photos and upsert products."
    );
    if (args.supplier) {
      console.log(
        `(Would also record RMB prices as quotes for supplier ${args.supplier}, tagged by source file.)`
      );
    }
    return;
  }

  // -------------------------------------------------------------- commit ------
  const { url, serviceKey } = loadEnv();
  if (!serviceKey) {
    console.error(
      "\n--commit needs SUPABASE_SERVICE_ROLE_KEY in ../.env.local (bypasses RLS for bulk write)."
    );
    process.exit(1);
  }
  const supabase = createClient(url, serviceKey, {
    auth: { persistSession: false },
  });

  const { data: buckets } = await supabase.storage.listBuckets();
  if (!buckets?.some((b) => b.name === bucket)) {
    console.log(`\nCreating public storage bucket "${bucket}"…`);
    const { error } = await supabase.storage.createBucket(bucket, { public: true });
    if (error) {
      console.error(`Failed to create bucket: ${error.message}`);
      process.exit(1);
    }
  }

  let uploaded = 0;
  let upserted = 0;
  let quotesInserted = 0;
  const failures = [];

  for (const r of allRecords) {
    if (!r.sku) continue; // unmatched images are reported, not force-imported

    let photoUrl = null;
    if (r.image) {
      const key = skuToKey(r.sku, r.image.ext);
      const { error: upErr } = await supabase.storage
        .from(bucket)
        .upload(key, r.image.buffer, {
          contentType: contentType(r.image.ext),
          upsert: true,
        });
      if (upErr) {
        failures.push(`upload ${r.sku} [${r.sourceFile}]: ${upErr.message}`);
      } else {
        uploaded++;
        photoUrl = supabase.storage.from(bucket).getPublicUrl(key).data.publicUrl;
      }
    }

    const productPayload = {
      sku: r.sku,
      name: r.name ?? r.sku,
      spec_summary: r.spec_summary,
    };
    if (photoUrl) productPayload.photo_url = photoUrl;

    const { data: prod, error: prodErr } = await supabase
      .from("products")
      .upsert(productPayload, { onConflict: "sku" })
      .select("id")
      .single();
    if (prodErr) {
      failures.push(`upsert ${r.sku} [${r.sourceFile}]: ${prodErr.message}`);
      continue;
    }
    upserted++;

    if (args.supplier && r.rmb != null) {
      const { error: qErr } = await supabase.from("supplier_quotes").insert({
        supplier_id: args.supplier,
        product_id: prod.id,
        rmb_price: r.rmb,
        moq: r.moq,
        source_file: r.sourceFile,
        notes: `Imported from ${r.sourceFile}`,
      });
      if (qErr) failures.push(`quote ${r.sku} [${r.sourceFile}]: ${qErr.message}`);
      else quotesInserted++;
    }
  }

  console.log("\n──────────── COMMITTED ────────────");
  console.log(`Photos uploaded:     ${uploaded}`);
  console.log(`Products upserted:   ${upserted}`);
  if (args.supplier) console.log(`Quotes inserted:     ${quotesInserted}`);
  if (failures.length) {
    console.log(`\nFailures (${failures.length}):`);
    for (const f of failures.slice(0, 30)) console.log(`   ${f}`);
    if (failures.length > 30) console.log(`   …and ${failures.length - 30} more`);
  } else {
    console.log("No failures.");
  }
}

main().catch((err) => {
  console.error("\nFatal:", err);
  process.exit(1);
});
