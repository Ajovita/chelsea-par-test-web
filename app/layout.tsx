import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Kold Creative Studio — Photography, Film & Social",
  description: "Visual stories with a different perspective. Explore photography, videography and social content packages at Kold Creative Studio.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
