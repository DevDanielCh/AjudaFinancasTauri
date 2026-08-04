import { Geist, Geist_Mono, Inter } from "next/font/google"

import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import { Toaster } from "@/components/ui/sonner"
import { MonthProvider } from "@/lib/month-context"
import { Sidebar } from "@/components/Sidebar"
import { UpdateDialog } from "@/components/UpdateDialog"
import { cn } from "@/lib/utils"

const inter = Inter({subsets:['latin'],variable:'--font-sans'})

const fontMono = Geist_Mono({
  subsets: ["latin"],
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
      className={cn("antialiased", fontMono.variable, "font-sans", inter.variable)}
    >
      <body>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <MonthProvider>
            <div className="flex min-h-screen">
              <Sidebar />
              <main className="flex-1 p-6">
                <div className="mx-auto max-w-5xl">{children}</div>
              </main>
            </div>
            <Toaster position="top-right" richColors />
            <UpdateDialog />
          </MonthProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
