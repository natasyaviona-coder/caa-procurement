import { NextResponse, type NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";

// OCR for Quotes Field: extract price / qty / carton dims / CBM from a photo
// taken at the supplier (price tags, cartons, handwritten quotes — often
// Chinese). Requires ANTHROPIC_API_KEY in .env.local; without it this
// endpoint returns 501 and the capture form falls back to manual typing.

const EXTRACTION_SCHEMA = {
  type: "object",
  properties: {
    product_name: {
      anyOf: [{ type: "string" }, { type: "null" }],
      description: "Product name/description if visible, translated to English",
    },
    price_rmb: {
      anyOf: [{ type: "number" }, { type: "null" }],
      description: "Unit price in RMB (¥). null if not visible.",
    },
    qty_per_carton: {
      anyOf: [{ type: "integer" }, { type: "null" }],
      description: "Pieces per carton (装箱量 / pcs per ctn). null if not visible.",
    },
    cbm: {
      anyOf: [{ type: "number" }, { type: "null" }],
      description: "Carton volume in cubic meters if stated directly. null otherwise.",
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
  },
  required: [
    "product_name",
    "price_rmb",
    "qty_per_carton",
    "cbm",
    "carton_p_cm",
    "carton_l_cm",
    "carton_t_cm",
  ],
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
      model: "claude-opus-4-8",
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
                "Extract the product/pricing fields. Dimensions like 51.5*37*50 or 51.5×37×50 are carton P×L×T in cm. " +
                "A price like ¥42, 42元, or a bare number next to 单价/price is the RMB unit price. " +
                "装箱量 or pcs/ctn is qty per carton. Use null for anything not clearly visible — do not guess.",
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
