import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { DashboardShell } from "@/components/layout/DashboardShell";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-sans",
  weight: "100 900",
});

const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

export const metadata: Metadata = {
  title: "xAID Internal QA Dashboard",
  description: "Doctor vs Validator Radiology Report Quality Analysis",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} font-sans antialiased`}
      >
        <div className="min-h-screen flex flex-col">
          <DashboardShell>{children}</DashboardShell>
        </div>
      </body>
    </html>
  );
}
