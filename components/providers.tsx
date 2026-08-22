"use client"

import { useState } from "react"

import { QueryClient, QueryClientProvider } from "@tanstack/react-query"

export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(() => {
    // Durante a captura do boneyard (npx boneyard-js build) não há backend
    // Tauri no browser: mantém as queries pendentes para que os <Skeleton>
    // com fixture permaneçam montados até o snapshot.
    const isBoneCapture =
      typeof window !== "undefined" &&
      (window as unknown as { __BONEYARD_BUILD?: boolean }).__BONEYARD_BUILD === true
    return new QueryClient({
      defaultOptions: {
        queries: {
          staleTime: 30_000,
          retry: isBoneCapture ? 100 : 1,
          retryDelay: isBoneCapture ? 60_000 : undefined,
          refetchOnWindowFocus: false,
        },
      },
    })
  })

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}
