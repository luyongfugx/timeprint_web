"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";

type ShareLink = {
  id: string;
  watermark_name: string;
  company_name: string;
  cover_image_url?: string | null;
  json_download_url?: string | null;
  status?: number;
  created_at?: string;
  share_code?: string;
};

export default function Page() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const code = searchParams?.get("code");

  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ShareLink | null>(null);

  useEffect(() => {
    if (!code) return;

    let mounted = true;
    setLoading(true);
    setError(null);

    fetch(`/api/applink/${encodeURIComponent(code)}`)
      .then((res) => res.json())
      .then((json) => {
        if (!mounted) return;
        if (json?.shareLink) {
          setData(json.shareLink as ShareLink);
        } else if (json?.error) {
          setError(json.error);
        } else {
          setError("Unexpected response from server");
        }
      })
      .catch((err) => {
        if (!mounted) return;
        setError(err?.message || "Network error");
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [code]);

  const handleUse = () => {
    // 跳转或调用后续逻辑。这里我们演示跳转回 app 的编辑/创建页面，并携带 share code
    // if (!data?.share_code) return;
    // router.push(`/create?share_code=${encodeURIComponent(data.share_code)}`);
  };

  return (
    <div className="bg-background flex min-h-screen flex-col items-center px-4 py-6">
      <div className="w-full max-w-md">
        {!code ? (
          <div className="py-12 text-center">
            <h2 className="text-lg font-medium text-yellow-600">缺少分享码</h2>
            <p className="mt-2 text-sm text-yellow-700">请通过带有 code 参数的分享链接访问此页面。</p>
          </div>
        ) : loading ? (
          <div className="py-12 text-center">加载中…</div>
        ) : error ? (
          <div className="py-12 text-center">
            <h2 className="text-lg font-medium">加载失败</h2>
            <p className="text-muted-foreground mt-2 text-sm">{error}</p>
          </div>
        ) : data ? (
          <div className="bg-card overflow-hidden rounded-lg shadow-sm">
            <div className="relative h-64 w-full bg-gray-100">
              {data.cover_image_url ? (
                // cover image
                // eslint-disable-next-line @next/next/no-img-element
                <img src={data.cover_image_url} alt={data.watermark_name} className="h-full w-full object-cover" />
              ) : (
                <div className="text-muted-foreground flex h-full w-full items-center justify-center">无封面图片</div>
              )}

              <a href="https://www.timeprint.net/en/?json_url=jsonurl"> 使用水印</a>
            </div>

            <div className="p-4">
              <h3 className="truncate text-lg font-semibold text-yellow-600">{data.watermark_name}</h3>
              <p className="mt-1 truncate text-sm text-yellow-700">{data.company_name}</p>

              <div className="text-muted-foreground mt-4 text-sm">
                <div>生成时间: {data.created_at ? new Date(data.created_at).toLocaleString() : "-"}</div>
                <div className="mt-2">状态: {typeof data.status === "number" ? data.status : "-"}</div>
              </div>
            </div>
          </div>
        ) : (
          <div className="py-12 text-center">无可展示的数据</div>
        )}
      </div>
    </div>
  );
}
