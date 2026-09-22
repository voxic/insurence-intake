import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Acme Insurance intake",
  description:
    "Desktop demo of a physical phone running a speech-to-speech insurance intake agent.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className="h-full antialiased"
    >
      <body className="min-h-full">{children}</body>
    </html>
  );
}
