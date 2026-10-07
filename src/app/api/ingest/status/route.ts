import { NextResponse } from "next/server";
import { requireAdminApiAccess } from "@/lib/auth/api-guard";

export async function GET(request: Request) {
  const denied = await requireAdminApiAccess(request);
  if (denied) return denied;

  return NextResponse.json({
    configured: Boolean(process.env.OPENAI_API_KEY),
    contentModel: process.env.OPENAI_CONTENT_MODEL || "gpt-6-luna",
    ocrModel:
      process.env.OPENAI_OCR_MODEL ||
      process.env.OPENAI_CONTENT_MODEL ||
      "gpt-6-luna",
  });
}
