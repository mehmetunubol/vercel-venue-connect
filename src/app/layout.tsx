import type { Metadata, Viewport } from "next";
import TabBar from "@/components/TabBar";
import "./globals.css";

export const metadata: Metadata = {
  title: "Venue Connect",
  description: "Meet people from the places you go. Profiles last 24 hours, chats are end-to-end encrypted.",
  applicationName: "Venue Connect",
  appleWebApp: { capable: true, title: "Venue Connect", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  interactiveWidget: "resizes-content",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#e8e2d6" },
    { media: "(prefers-color-scheme: dark)", color: "#121315" },
  ],
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <main className="safe-top mx-auto w-full max-w-md px-4 pb-32">{children}</main>
        <TabBar />
      </body>
    </html>
  );
}
