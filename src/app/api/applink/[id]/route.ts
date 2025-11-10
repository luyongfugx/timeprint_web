import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabaseServer";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const awaitedParams = await params;
    const shareCode = awaitedParams.id;

    if (!shareCode) {
      return NextResponse.json({ error: "Missing share code" }, { status: 400 });
    }

    const supabase = await createClient();

    const { data: shareLink, error } = await supabase
      .from("watermarks_share_links")
      .select("*")
      .eq("share_code", shareCode)
      .single();

    if (error) {
      // If row not found, Supabase returns null data without error; handle generically
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    if (!shareLink) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({ shareLink });
  } catch (err) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const awaitedParams = await params;
    const shareCode = awaitedParams.id;

    if (!shareCode) {
      return NextResponse.json({ error: "Missing share code" }, { status: 400 });
    }

    const body = await request.json();
    const { watermarkName, companyName, coverImageUrl, jsonDownloadUrl, status } = body ?? {};

    const supabase = await createClient();

    const updates: Record<string, any> = {};
    if (typeof watermarkName === "string") updates.watermark_name = watermarkName;
    if (typeof companyName === "string") updates.company_name = companyName;
    if (typeof coverImageUrl === "string") updates.cover_image_url = coverImageUrl;
    if (typeof jsonDownloadUrl === "string") updates.json_download_url = jsonDownloadUrl;
    if (typeof status === "number") updates.status = status;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("watermarks_share_links")
      .update(updates)
      .eq("share_code", shareCode)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, updated: data });
  } catch (err) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const awaitedParams = await params;
    const shareCode = awaitedParams.id;

    if (!shareCode) {
      return NextResponse.json({ error: "Missing share code" }, { status: 400 });
    }

    const supabase = await createClient();

    const { error } = await supabase.from("watermarks_share_links").delete().eq("share_code", shareCode);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
