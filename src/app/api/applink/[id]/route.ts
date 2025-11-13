import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabaseServer";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const awaitedParams = await params;
    const shareCode = awaitedParams.id;

    if (!shareCode) {
      return NextResponse.json({ error: "Missing share code" }, { status: 400, headers: corsHeaders });
    }

    const supabase = await createClient();
    const nowSec = Math.floor(Date.now() / 1000);

    const { data: shareLink, error } = await supabase
      .from("watermarks_share_links")
      .select("*")
      .eq("share_code", shareCode)
      .eq("status", 0)
      .or(`expire_time.eq.0,expire_time.gt.${nowSec}`)
      .single();

    if (error) {
      console.log(error);
      // If row not found, Supabase returns null data without error; handle generically
      return NextResponse.json({ error: error.message }, { status: 400, headers: corsHeaders });
    }

    if (!shareLink) {
      return NextResponse.json({ error: "Not found" }, { status: 404, headers: corsHeaders });
    }

    return NextResponse.json({ shareLink }, { headers: corsHeaders });
  } catch (err) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500, headers: corsHeaders });
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const awaitedParams = await params;
    const shareCode = awaitedParams.id;

    if (!shareCode) {
      return NextResponse.json({ error: "Missing share code" }, { status: 400, headers: corsHeaders });
    }

    const body = await request.json();
    const { watermarkName, companyName, coverImageUrl, jsonDownloadUrl, status, expireType } = body ?? {};

    const supabase = await createClient();

    const updates: Record<string, any> = {};
    if (typeof watermarkName === "string") updates.watermark_name = watermarkName;
    if (typeof companyName === "string") updates.company_name = companyName;
    if (typeof coverImageUrl === "string") updates.cover_image_url = coverImageUrl;
    if (typeof jsonDownloadUrl === "string") updates.json_download_url = jsonDownloadUrl;
    if (typeof status === "number") updates.status = status;

    // Optional: update expire_time based on expireType (0: forever, 1: 30 days, 2: 1 day, 3: 1 hour)
    if (typeof expireType === "number") {
      const nowSec = Math.floor(Date.now() / 1000);
      let expireTime = 0;
      switch (expireType) {
        case 1:
          expireTime = nowSec + 30 * 24 * 60 * 60;
          break;
        case 2:
          expireTime = nowSec + 24 * 60 * 60;
          break;
        case 3:
          expireTime = nowSec + 60 * 60;
          break;
        default:
          expireTime = 0;
      }
      updates.expire_time = expireTime;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "No valid fields to update" }, { status: 400, headers: corsHeaders });
    }

    const { data, error } = await supabase
      .from("watermarks_share_links")
      .update(updates)
      .eq("share_code", shareCode)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400, headers: corsHeaders });
    }

    return NextResponse.json({ success: true, updated: data }, { headers: corsHeaders });
  } catch (err) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500, headers: corsHeaders });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const awaitedParams = await params;
    const shareCode = awaitedParams.id;

    if (!shareCode) {
      return NextResponse.json({ error: "Missing share code" }, { status: 400, headers: corsHeaders });
    }

    const supabase = await createClient();

    const { error } = await supabase.from("watermarks_share_links").delete().eq("share_code", shareCode);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400, headers: corsHeaders });
    }

    return NextResponse.json({ success: true }, { headers: corsHeaders });
  } catch (err) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500, headers: corsHeaders });
  }
}
