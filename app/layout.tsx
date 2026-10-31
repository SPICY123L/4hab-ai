import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = { title: "4hab AI", description: "مساعدك الذكي — 4hab AI" };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ar" dir="rtl"><body>{children}</body></html>;
}
