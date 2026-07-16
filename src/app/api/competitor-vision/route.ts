import { NextResponse, type NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";

// Vision extraction for the competitor bulk-picture upload: given a marketplace
// screenshot (Shopee / TikTok Shop), pull the product name, current sell price,
// size/spec info, and a normalized bounding box around the main product photo
// so the client can crop it. Requires ANTHROPIC_API_KEY.

const BOX_PROPS = {
  x: { type: "number", description: "Left edge, 0..1 fraction of width." },
  y: { type: "number", description: "Top edge, 0..1 fraction of height." },
  width: { type: "number", description: "Box width, 0..1 fraction of width." },
  height: { type: "number", description: "Box height, 0..1 fraction of height." },
} as const;

const EXTRACTION_SCHEMA = {
  type: "object",
  properties: {
    name: {
      anyOf: [{ type: "string" }, { type: "null" }],
      description:
        "The product name. If a variant is highlighted/selected (e.g. a red " +
        "outlined option), use that specific variant's name.",
    },
    price_idr: {
      anyOf: [{ type: "number" }, { type: "null" }],
      description:
        "Current selling price in Indonesian Rupiah, as a plain number (e.g. " +
        "52990). Use the prominent/active price, NOT a crossed-out original. " +
        "Ignore thousands separators and the 'Rp' prefix.",
    },
    info: {
      anyOf: [{ type: "string" }, { type: "null" }],
      description:
        "Any size, dimension, capacity, or material info visible (often printed " +
        "on the product image), e.g. '14.5 x 17 cm, capacity 4 x 160 ml'. null if none.",
    },
    product_box: {
      anyOf: [
        { type: "object", properties: BOX_PROPS, required: ["x", "y", "width", "height"], additionalProperties: false },
        { type: "null" },
      ],
      description:
        "Normalized bounding box (origin top-left, 0..1) tightly around the MAIN " +
        "product photo — not variant thumbnails, not the whole screenshot. null if unclear.",
    },
  },
  required: ["name", "price_idr", "info", "product_box"],
  additionalProperties: false,
} as const;

const ALLOWED_MEDIA = new Set(["image/jpeg", "image/png", "image/gif", "image/webp"]);

export async function POST(request: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      {
        error:
          "Picture analysis isn't configured — add ANTHROPIC_API_KEY (console.anthropic.com → API keys).",
      },
      { status: 501 }
    );
  }

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
                media_type: mediaType as
                  | "image/jpeg"
                  | "image/png"
                  | "image/gif"
                  | "image/webp",
                data,
              },
            },
            {
              type: "text",
              text:
                "This is a screenshot of a product listing on an Indonesian marketplace " +
                "(Shopee or TikTok Shop). Extract the product name (use the selected/" +
                "highlighted variant if one is outlined), the current selling price in IDR " +
                "as a plain number, any size/capacity/material info printed on the image, " +
                "and a tight normalized bounding box around the single main product photo.",
            },
          ],
        },
      ],
    });

    if (response.stop_reason === "refusal") {
      return NextResponse.json({ error: "Could not process this image" }, { status: 422 });
    }
    const textBlock = response.content.find(
      (b): b is Anthropic.TextBlock => b.type === "text"
    );
    if (!textBlock) return NextResponse.json({ error: "no result" }, { status: 502 });
    return NextResponse.json(JSON.parse(textBlock.text));
  } catch (err) {
    const message =
      err instanceof Anthropic.APIError ? `Analysis failed: ${err.message}` : "Analysis failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
