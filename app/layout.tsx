import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "مفكرة الوسيط",
  description: "MVP لإدارة العروض والطلبات والعملاء والتذكيرات العقارية.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="rtl">
      <body>{children}</body>
    </html>
  );
}
