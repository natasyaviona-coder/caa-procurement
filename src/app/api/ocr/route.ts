import { NextResponse, type NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";

// OCR for Quotes Field: extract price / qty / carton dims / CBM from a photo
// taken at the supplier (price tags, cartons, handwritten quotes — often
// Chinese). Requires ANTHROPIC_API_KEY in .env.local; without it this
// endpoint returns 501 and the capture form falls back to manual typing.

const VARIANT_PROPERTIES = {
  label: {
    anyOf: [{ type: "string" }, { type: "null" }],
    description:
      "Option/variant label when the photo lists more than one price, " +
      "e.g. 带4杯 → 'with 4 cups', 无杯 → 'no cups', a size like '9 inch'. " +
      "Translate to English. null if there is only a single price with no distinct option.",
  },
  price_rmb: {
    anyOf: [{ type: "number" }, { type: "null" }],
    description: "Unit price in RMB (¥) for this option. null if not visible.",
  },
  qty_per_carton: {
    anyOf: [{ type: "integer" }, { type: "null" }],
    description: "Pieces/sets per carton (装箱量 / pcs or set per ctn). null if not visible.",
  },
  cbm: {
    anyOf: [{ type: "number" }, { type: "null" }],
    description: "Carton volume in cubic meters (CBM) if stated. null otherwise.",
  },
  carton_p_cm: {
    anyOf: [{ type: "number" }, { type: "null" }],
    description: "Carton length in cm (first dimension of e.g. 外箱 51.5*37*50).",
  },
  carton_l_cm: {
    anyOf: [{ type: "number" }, { type: "null" }],
    description: "Carton width in cm (second dimension).",
  },
  carton_t_cm: {
    anyOf: [{ type: "number" }, { type: "null" }],
    description: "Carton height in cm (third dimension).",
  },
} as const;

const EXTRACTION_SCHEMA = {
  type: "object",
  properties: {
    product_name: {
      anyOf: [{ type: "string" }, { type: "null" }],
      description:
        "Shared base product name/description (without the per-option label), " +
        "translated to English. e.g. '5L bucket + electroplated stand'.",
    },
    translation: {
      anyOf: [{ type: "string" }, { type: "null" }],
      description:
        "A faithful plain-English translation of ALL text visible in the photo " +
        "(handwriting, printed labels, stamps), preserving line breaks so the " +
        "buyer can read the whole note. null if there is no text.",
    },
    variants: {
      type: "array",
      description:
        "One entry per distinct price option shown. If the photo has a single " +
        "price, return exactly one entry (with label null). If it lists several " +
        "options (e.g. 带4杯 ¥28.8 and 无杯 ¥24.5), return one entry per option.",
      items: {
        type: "object",
        properties: VARIANT_PROPERTIES,
        required: [
          "label",
          "price_rmb",
          "qty_per_carton",
          "cbm",
          "carton_p_cm",
          "carton_l_cm",
          "carton_t_cm",
        ],
        additionalProperties: false,
      },
    },
  },
  required: ["product_name", "translation", "variants"],
  additionalProperties: false,
} as const;

const ALLOWED_MEDIA = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
]);

export async function POST(request: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      {
        error:
          "OCR is not configured yet — add ANTHROPIC_API_KEY to .env.local (console.anthropic.com → API keys). You can type the numbers manually meanwhile.",
      },
      { status: 501 }
    );
  }

  // Only signed-in users may spend OCR credits.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const formData = await request.formData();
  const image = formData.get("image");
  if (!(image instanceof File)) {
    return NextResponse.json({ error: "image file required" }, { status: 400 });
  }
  const mediaType = ALLOWED_MEDIA.has(image.type) ? image.type : "image/jpeg";
  const data = Buffer.from(await image.arrayBuffer()).toString("base64");

  try {
    const anthropic = new Anthropic({ apiKey });
    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 1024,
      output_config: { format: { type: "json_schema", schema: EXTRACTION_SCHEMA } },
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: mediaType as "image/jpeg" | "image/png" | "image/gif" | "image/webp",
                data,
              },
            },
            {
              type: "text",
              text:
                "This photo was taken at a Chinese supplier (price tag, carton label, or handwritten quote — text may be Chinese). " +
                "Extract the product and one entry per price option into `variants`. " +
                "IMPORTANT: many quotes list several options for the same product — e.g. " +
                "'带4杯：¥28.8  20set  0.11cbm' and '无杯：¥24.5  20set  0.11cbm' means TWO variants " +
                "(with 4 cups / no cups) at different prices — return one entry for each, with its label translated. " +
                "If there is only one price, return a single entry with label null. " +
                "Dimensions like 51.5*37*50 or 51.5×37×50 are carton P×L×T in cm. " +
                "A price like ¥42, 42元, or a bare number next to 单价/price is the RMB unit price. " +
                "装箱量, set/ctn, or pcs/ctn is qty per carton. Use null for anything not clearly visible — do not guess. " +
                "Also set `translation` to a faithful English translation of EVERY piece of text visible in the photo, line by line, so the buyer can read the whole note.",
            },
          ],
        },
      ],
    });

    if (response.stop_reason === "refusal") {
      return NextResponse.json(
        { error: "Could not process this image" },
        { status: 422 }
      );
    }

    const textBlock = response.content.find(
      (b): b is Anthropic.TextBlock => b.type === "text"
    );
    if (!textBlock) {
      return NextResponse.json({ error: "no result" }, { status: 502 });
    }
    return NextResponse.json(JSON.parse(textBlock.text));
  } catch (err) {
    const message =
      err instanceof Anthropic.APIError
        ? `OCR failed: ${err.message}`
        : "OCR failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
