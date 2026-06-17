import type { Metadata } from "next";
import "./globals.css";
import Providers from "./providers";
import { AuthProvider } from "@/context/AuthContext";
import { WebSocketProvider } from "@/context/WebSocketContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import Sidebar from "@/components/Sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "sonner";

import GlobalAIPanel from "@/components/GlobalAIPanel";

export const metadata: Metadata = {
  title: "Sentinel Mesh — IoT Health Surveillance Dashboard",
  description:
    "Real-time disease surveillance and early warning system powered by Tracy IoT wearables. Bridging the 1% vitals gap for automated outbreak detection.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="light">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,400&family=Inter:wght@400;500;600;700&family=Outfit:wght@400;500;600;700;800;900&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="antialiased h-screen bg-[#161b2c] text-foreground font-body overflow-hidden">
        <Providers>
          <AuthProvider>
            <WebSocketProvider>
              <TooltipProvider>
                <div className="flex h-screen overflow-hidden">
                  <Sidebar />
                  <main className="flex-1 flex flex-col min-w-0 bg-[#f4f7f9] rounded-[1.5rem] overflow-hidden shadow-2xl ring-1 ring-white/10 relative z-10 m-2">
                    <ProtectedRoute>{children}</ProtectedRoute>
                  </main>
                </div>
                <Toaster position="bottom-center" theme="dark" />
                <GlobalAIPanel />
              </TooltipProvider>
            </WebSocketProvider>
          </AuthProvider>
        </Providers>
      </body>
    </html>
  );
}
