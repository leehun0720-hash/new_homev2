import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Ten AI",
  description: "AX HUB PLATFORM",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
