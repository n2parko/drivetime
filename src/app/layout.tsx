import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "DriveTime - Your Daily Audio Digest",
  description: "Capture ideas, articles, and questions throughout the day. Listen as audio episodes on your drive.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased min-h-screen">
        {children}
      </body>
    </html>
  );
}
