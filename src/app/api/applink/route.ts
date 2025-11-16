import { createClient } from "@/lib/supabaseServer";
import { type NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

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
    const { watermarkName, companyName, coverImageUrl, jsonDownloadUrl, status, userId, expireType } =
      await request.json();

    // 验证必要字段（companyName 可选）
    if (!watermarkName || !coverImageUrl || !jsonDownloadUrl || !userId) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400, headers: corsHeaders });
    }

    // 计算过期时间（Unix 秒级时间戳）；0 表示永不过期
    const nowSec = Math.floor(Date.now() / 1000);
    let expireTime = 0;
    switch (expireType) {
      case 1: // 一个月内不过期（按30天计算）
        expireTime = nowSec + 30 * 24 * 60 * 60;
        break;
      case 2: // 一天内不过期
        expireTime = nowSec + 24 * 60 * 60;
        break;
      case 3: // 一小时内不过期
        expireTime = nowSec + 60 * 60;
        break;
      default: // 0 或未传：永不过期
        expireTime = 0;
    }

    const supabase = await createClient();

    // 生成8位随机码
    const randomCode = crypto.randomBytes(4).toString("hex").toUpperCase();

    // 创建水印分享记录
    const { data: shareLink, error } = await supabase
      .from("watermarks_share_links")
      .insert({
        watermark_name: watermarkName,
        company_name: companyName || null,
        cover_image_url: coverImageUrl,
        json_download_url: jsonDownloadUrl,
        status: status || 0,
        created_at: new Date().toISOString(),
        user_id: userId,
        share_code: randomCode,
        expire_time: expireTime,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400, headers: corsHeaders });
    }

    // 构建分享链接
    const shareUrl = new URL("https://share.timeprint.net");
    shareUrl.pathname = "/share"; // 假设前端分享页面路径为 /share
    shareUrl.searchParams.set("code", randomCode);

    return NextResponse.json(
      {
        success: true,
        shareLink: shareUrl.toString(),
        shareCode: randomCode,
      },
      { headers: corsHeaders },
    );
  } catch (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500, headers: corsHeaders });
  }
}
