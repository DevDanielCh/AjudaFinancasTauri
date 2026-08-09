import { Inter, JetBrains_Mono } from "next/font/google"

import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import { Toaster } from "@/components/ui/toast"
import { MonthProvider } from "@/lib/month-context"
import { Sidebar } from "@/components/Sidebar"
import { MobileHeader } from "@/components/MobileHeader"
import { BottomBar } from "@/components/BottomBar"
import { UpdateDialog } from "@/components/UpdateDialog"
import { cn } from "@/lib/utils"

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
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <MonthProvider>
            <div className="flex min-h-screen">
              <Sidebar />
              <div className="flex min-w-0 flex-1 flex-col">
                <MobileHeader />
                <main className="flex-1 p-3 pb-24 sm:pb-3">
                  {children}
                </main>
              </div>
              <BottomBar />
            </div>
            <Toaster />
            <UpdateDialog />
          </MonthProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
