import { createClient } from "@/lib/supabaseServer";
import { type NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

export async function POST(request: NextRequest) {
  try {
    const { watermarkName, companyName, coverImageUrl, jsonDownloadUrl, status, userId } = await request.json();

    // 验证必要字段
    if (!watermarkName || !companyName || !coverImageUrl || !jsonDownloadUrl || !userId) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const supabase = await createClient();

    // 生成8位随机码
    const randomCode = crypto.randomBytes(4).toString("hex").toUpperCase();

    // 创建水印分享记录
    const { data: shareLink, error } = await supabase
      .from("watermarks_share_links")
      .insert({
        watermark_name: watermarkName,
        company_name: companyName,
        cover_image_url: coverImageUrl,
        json_download_url: jsonDownloadUrl,
        status: status || 0,
        created_at: new Date().toISOString(),
        user_id: userId,
        share_code: randomCode,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    // 构建分享链接
    const shareUrl = new URL(request.url);
    shareUrl.pathname = "/share"; // 假设前端分享页面路径为 /share
    shareUrl.searchParams.set("code", randomCode);

    return NextResponse.json({
      success: true,
      shareLink: shareUrl.toString(),
      shareCode: randomCode,
    });
  } catch (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
