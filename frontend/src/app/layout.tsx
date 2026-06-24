import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ 
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "Flowzint OmniCare AI | Enterprise Customer Support",
  description: "Next-generation AI-powered customer support platform for Flowzint — delivering instant, intelligent enterprise support with real-time streaming.",
  keywords: ["Flowzint", "Customer Support", "AI Bot", "Enterprise", "OmniCare"],
  openGraph: {
    title: "Flowzint OmniCare AI",
    description: "Intelligent enterprise customer support powered by AI",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.variable} font-sans antialiased`}>
        {children}
      </body>
    </html>
  );
}
