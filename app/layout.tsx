import type { Metadata } from "next";

import Providers from "./providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "Investing Garden",
  description: "A clean investing workspace for portfolio tracking, market notes, and research resources.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;700&family=JetBrains+Mono:wght@400;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="theme-greek-garden">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
