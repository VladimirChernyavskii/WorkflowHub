import type { Metadata } from "next";
import "@/lib/env";
import "./globals.css";

export const metadata: Metadata = {
  title: "WorkflowHub",
  description: "ComfyUI workflow catalog",
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
