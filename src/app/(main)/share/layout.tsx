import { type Metadata } from "next";

export const metadata: Metadata = {
  title: "Shared template · Timeprint",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};
export const dynamic = "force-dynamic";
export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
