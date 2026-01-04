import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "DocsDrivenEnglish",
  description: "公開ドキュメントURLから教材を生成し、クイズで学習するアプリ",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body className={`${geistSans.variable} ${geistMono.variable} app-bg antialiased`}>
        <div className="pointer-events-none fixed inset-0 -z-10">
          <div className="app-grid absolute inset-0" />
        </div>
        {children}
      </body>
    </html>
  );
}
