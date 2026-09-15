/** @type {import('next').NextConfig} */
const nextConfig = {
  devIndicators: false,
  distDir: process.env.NEXT_BUILD_DIR || ".next-timeprint",
  outputFileTracingRoot: process.cwd(),
  compiler: {
   // removeConsole: process.env.NODE_ENV === "production",
  },
  async headers() {
    return [{ source: "/share", headers: [{ key: "Cache-Control", value: "no-store" }, { key: "Referrer-Policy", value: "no-referrer" }, { key: "X-Robots-Tag", value: "noindex, nofollow" }] },
      { source: "/templates/contact", headers: [{ key: "Cache-Control", value: "no-store" }, { key: "Referrer-Policy", value: "no-referrer" }, { key: "X-Robots-Tag", value: "noindex, nofollow" }] }];
  },
  async redirects() {
    return [
      {
        source: "/dashboard",
        destination: "/dashboard/watermark",
        permanent: false,
      },
    ];
  },
}

export default nextConfig
