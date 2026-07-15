# Import scripts (local, not deployed)

These run on your machine, not on Vercel. They're the bulk "upload" path for
product photos + supplier prices, per [CLAUDE.md](../../warehouse-dashboard/CLAUDE.md) §6.

## `import-pricelist.mjs`

Pulls product photos + row data out of one or many supplier `.xlsx` files and
loads them into Supabase:

- Uploads each embedded photo to the `product-photos` storage bucket
- Upserts `products` by SKU (name, spec, `photo_url`)
- Optionally records the RMB price as a `supplier_quote` (with `--supplier`),
  tagged with `source_file` so it's filterable later in the Quotes page

It reads the raw `.xlsx` internals (drawings + media + shared strings) itself,
because normal spreadsheet libraries drop the floating product photos.

### Safe by default

Without `--commit` it **writes nothing** — it just prints a report per file
(images found / matched to a SKU / unmatched) plus a sample of the actual rows
that would be upserted:

```
─── FEI_NEW_EN.xlsx ───  (sheet "PET Series Products")
  Data rows parsed:          696
  Images found:              668
  Images matched to a SKU:   668
  Rows with SKU, no image:   28
  Images with NO SKU (⚠):    0
  Sample rows that WILL be upserted:
     A962-1  ·  A560 square 6-piece set  ·  ¥42  ·  has photo
     ...
     Does this look like product data? If not, exclude this file.
```

**Always read the sample rows, not just the counts.** A folder can contain
files that technically parse (something is sitting in the expected columns)
but aren't price lists at all — a bank statement, a ledger. The counts alone
won't tell you that; the sample will. See "Bulk mode" below.

Always dry-run first, read the report, then re-run with `--commit`.

### Setup

```bash
cd scripts
npm install
```

Add the **service role** key to `../.env.local` (Supabase → Project Settings →
API → `service_role`, under "Legacy" or the new secret key). This key bypasses
row-level security to bulk-write, so it lives only here in a local script —
never in the deployed app:

```
SUPABASE_SERVICE_ROLE_KEY=eyJ...   # or sb_secret_...
```

### Usage

```bash
# 1. Dry run — report only, writes nothing:
node import-pricelist.mjs --file "/c/Users/Natasya/Downloads/FEI_NEW_EN.xlsx"

# 2. Commit — upload photos + upsert products:
node import-pricelist.mjs --file "/path/to/PriceList.xlsx" --commit

# 3. Also record RMB prices as quotes for a supplier (get the UUID from the
#    Suppliers page URL, e.g. /suppliers/<uuid>):
node import-pricelist.mjs --file "/path/to/PriceList.xlsx" --commit --supplier <supplier-uuid>

# 4. Multiple files in one run — repeat --file, or --dir a folder:
node import-pricelist.mjs --file "/path/A.xlsx" --file "/path/B.xlsx" --commit --supplier <uuid>
node import-pricelist.mjs --dir "/path/to/price-lists-folder" --commit --supplier <uuid>
```

### Bulk mode (`--dir`)

`--dir` processes **every `.xlsx` file directly inside that folder** — it
doesn't know which ones are price lists. Two safety nets catch most mistakes
automatically:

- Files that don't parse as a spreadsheet at all (a `~$...` Excel lock file,
  a corrupt zip) are **skipped** with a reason shown.
- Files whose worksheet is far larger than any real price list we've seen
  (over ~5MB of worksheet XML — a giant financial workbook, for example) are
  **skipped** rather than processed for minutes.

But a file that's the *wrong kind of data in the right shape* — a bank
statement whose columns happen to line up with SKU/name/price — will still
"parse" without error. That's why the report shows sample rows per file:
**read them.** If a file's sample doesn't look like product data, don't
`--commit` that run — split it out and run the real price lists separately.

Safest habit: point `--dir` at a folder that only has price lists in it,
rather than your whole Downloads folder.

### Different supplier layouts

The default column mapping matches the FEI / translated-price-list format
(SKU=B, Name=D, RMB=C, Qty/Carton=F, Size=E, Color=H). If a supplier's sheet
differs, override per column:

```bash
node import-pricelist.mjs --file "/path/to/Other.xlsx" \
  --col-sku A --col-name C --col-rmb D --col-qty E
```

Other flags: `--header-rows N` (default 1), `--bucket <name>` (default
`product-photos`).

### Notes

- Re-running is safe: products upsert by SKU, photos overwrite by SKU key. A
  file with no images won't wipe existing `photo_url` values.
- Unmatched images (an image with no SKU on its row) are **reported, not
  imported** — they need a manual look, per §6.
- This does not auto-create quotes unless `--supplier` is given.
