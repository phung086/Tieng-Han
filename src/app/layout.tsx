import type { Metadata } from "next";
import { Be_Vietnam_Pro, Noto_Sans_KR } from "next/font/google";
import { AppShell } from "@/components/app-shell";
import "./globals.css";

const vietnamese = Be_Vietnam_Pro({
  subsets: ["latin", "vietnamese"],
  variable: "--font-ui",
  weight: ["400", "500", "600", "700", "800"],
});

const korean = Noto_Sans_KR({
  subsets: ["latin"],
  variable: "--font-korean",
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Haneul — Học tiếng Hàn",
  description: "Ôn luyện tiếng Hàn bám sát giáo trình, theo nhịp học của riêng bạn.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="vi">
      <body className={`${vietnamese.variable} ${korean.variable}`}>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
