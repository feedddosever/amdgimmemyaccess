import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { AmdDrawerLoader } from "@/components/Loaders";
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
  title: "MenuBridge",
  description: "Order in your language. The kitchen gets it in theirs.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        <AmdDrawerLoader />
      </body>
    </html>
  );
}
