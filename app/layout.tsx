import { Inter, JetBrains_Mono } from "next/font/google"
import type { Viewport } from "next"

import "./globals.css"
import "@/src/bones/registry"
import { ThemeProvider } from "@/components/theme-provider"
import { Providers } from "@/components/providers"
import { Toaster } from "@/components/ui/toast"
import { MonthProvider } from "@/lib/month-context"
import { AppShell } from "@/src/Accounts/AppShell"
import { UpdateDialog } from "@/components/UpdateDialog"
import { SyncOverlay } from "@/src/Sync/SyncOverlay"
import { cn } from "@/lib/utils"
import { SafeAreaInit } from "@/components/SafeAreaInit"

export const viewport: Viewport = {
  viewportFit: "cover",
}

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-sans",
})

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-mono",
})

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="pt-BR"
      suppressHydrationWarning
      className={cn("antialiased", inter.variable, jetbrainsMono.variable, "font-sans")}
    >
      <body>
        <SafeAreaInit />
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <Providers>
            <MonthProvider>
              <AppShell>
                <main className="w-full">{children}</main>
              </AppShell>
              <Toaster />
              <SyncOverlay />
              <UpdateDialog />
            </MonthProvider>
          </Providers>
        </ThemeProvider>
      </body>
    </html>
  )
}
