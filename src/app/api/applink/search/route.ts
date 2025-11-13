import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabaseServer";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { keyword, limit, page } = body ?? {};

    const supabase = await createClient();

    const perPage = typeof limit === "number" && limit > 0 && limit <= 500 ? limit : 20;
    const pageNum = typeof page === "number" && page > 0 ? page : 1;
    const from = (pageNum - 1) * perPage;
    const to = pageNum * perPage - 1;

    let query = supabase
      .from("watermarks_share_links")
      .select(
        "id,watermark_name,company_name,cover_image_url,json_download_url,status,created_at,share_code,expire_time",
      )
      // .gte("status", 0)
      .order("created_at", { ascending: false })
      .range(from, to);

    if (keyword && typeof keyword === "string" && keyword.trim() !== "") {
      // 安全转义 % 和 _ 避免注入通配符（简单处理）
      const escaped = keyword.replace(/[%_]/g, (m) => `\\${m}`);
      const pattern = `%${escaped}%`;
      query = query.or(`company_name.ilike.${pattern},watermark_name.ilike.${pattern}`);
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400, headers: corsHeaders });
    }

    return NextResponse.json({ results: data ?? [], page: pageNum, perPage }, { headers: corsHeaders });
  } catch (err) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500, headers: corsHeaders });
  }
}
