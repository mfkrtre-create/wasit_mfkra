import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "تجربة الإدخال العقاري الذكي",
  description: "MVP لاستخراج بيانات العقار من النص والصوت العربي.",
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
