import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    configured: Boolean(process.env.OPENAI_API_KEY),
    contentModel: process.env.OPENAI_CONTENT_MODEL || "gpt-6-luna",
    ocrModel:
      process.env.OPENAI_OCR_MODEL ||
      process.env.OPENAI_CONTENT_MODEL ||
      "gpt-6-luna",
  });
}
