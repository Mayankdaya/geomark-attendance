import type { Metadata, Viewport } from "next";
import { Instrument_Serif, Instrument_Sans, IBM_Plex_Mono } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const serif = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  variable: "--font-serif",
  display: "swap",
});

const sans = Instrument_Sans({
  subsets: ["latin"],
  variable: "--font-sans-app",
  display: "swap",
});

const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-mono-app",
  display: "swap",
});

export const metadata: Metadata = {
  title: "GeoMark — GPS Smart Attendance",
  description:
    "GPS-verified attendance: teachers open 10-minute sessions, students check in only from inside the 30 m classroom geofence.",
};

export const viewport: Viewport = {
  themeColor: "#f6f3ec",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${serif.variable} ${sans.variable} ${mono.variable}`}>
      <body>
        {children}
        <Toaster />
      </body>
    </html>
  );
}
