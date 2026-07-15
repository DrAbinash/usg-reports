import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ThemeProvider } from "@/components/ui/sonner";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "CARE AI Sonologist Companion™ — CARE Diagnostics",
  description: "Intelligent AI Ultrasound Companion for real-time measurement extraction, smart reporting, and clinical decision support. GE Voluson E9 integration.",
  keywords: ["ultrasound", "AI", "sonologist", "DICOM", "OB-GYN", "reporting", "CARE Diagnostics", "medical AI"],
  authors: [{ name: "CARE Diagnostics" }],
  icons: {
    icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><circle cx='16' cy='16' r='14' fill='%230d9488' stroke='%230f766e' stroke-width='2'/><path d='M12 10v12l10-6z' fill='white'/></svg>",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}