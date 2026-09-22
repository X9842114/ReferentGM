import type { Metadata } from "next";
import { AmbientBackground } from "@/components/ambient-background";
import { Fraunces, Geist, Geist_Mono, Outfit } from "next/font/google";
import "./globals.css";

const geist = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
});

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "RefGM · Référents GameMaster",
  description: "Espace privé des référents GameMaster",
};

export const viewport = {
  themeColor: "#030304",
  colorScheme: "dark",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="fr"
      className={`dark ${outfit.variable} ${fraunces.variable} ${geist.variable} ${geistMono.variable} h-full bg-background antialiased`}
      style={{ colorScheme: "dark" }}
    >
      <body className="flex min-h-full flex-col bg-background text-foreground">
        <AmbientBackground />
        {children}
      </body>
    </html>
  );
}
