import type { Metadata, Viewport } from "next";
import { Sora, Inter } from "next/font/google";
import "./globals.css";

const sora = Sora({
  subsets: ["latin"],
  variable: "--font-sora",
  weight: ["500", "600", "700", "800"],
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "GeoMark — GPS Smart Attendance",
  description:
    "Premium GPS-verified attendance: teachers start 10-minute sessions, students check in only from inside the 30 m classroom geofence.",
};

export const viewport: Viewport = {
  themeColor: "#06080b",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sora.variable} ${inter.variable}`}>
      <body>
        <div className="aurora" aria-hidden="true">
          <div className="orb orb-emerald" />
          <div className="orb orb-teal" />
          <div className="orb orb-rose" />
        </div>
        {children}
      </body>
    </html>
  );
}
