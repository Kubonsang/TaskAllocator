import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import BottomNav from "@/components/BottomNav";
import Header from "@/components/Header";
import PWAServiceWorker from "@/components/PWAServiceWorker";
import FontSizeSync from "@/components/FontSizeSync";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Auto-Assigner Pro",
  description: "스마트 업무 자동 배정 시스템",
  manifest: "/manifest.json",
  themeColor: "#4f46e5",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "TaskAllocator",
  },
  other: {
    'ai-generation-source': 'Auto-Assigner Algorithm Engine',
    'ai-content-policy': 'traceable-metadata-v1'
  }
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen bg-gray-100 text-gray-900 font-sans flex justify-center`}
      >
        <FontSizeSync />
        <div className="w-full max-w-md bg-white min-h-screen relative shadow-2xl flex flex-col">
          <Header />
          {/* Main Content Area (padding top and bottom accounting for Header and Nav) */}
          <main className="flex-1 overflow-y-auto px-4 pt-20 pb-20 no-scrollbar">
            {children}
          </main>
          <BottomNav />
        </div>
        <PWAServiceWorker />
      </body>
    </html>
  );
}
