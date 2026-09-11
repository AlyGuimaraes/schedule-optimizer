import type { Metadata } from "next"
import { Geist_Mono, Inter } from "next/font/google"
import { headers } from "next/headers"
import { Analytics } from "@vercel/analytics/next"
import { SpeedInsights } from "@vercel/speed-insights/next"

import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import { TooltipProvider } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

const fontSans = Inter({ subsets: ["latin"], variable: "--font-sans" })

// Geist Mono só nos números, com tabular-nums
const fontMono = Geist_Mono({ subsets: ["latin"], variable: "--font-mono" })

export const metadata: Metadata = {
  title: {
    default: "Cadência · Gestão e Otimização de Agendas · LeverPro",
    template: "%s · Cadência",
  },
  description:
    "Gestão e otimização de agendas da operação de implantação LeverPro.",
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  // nonce da CSP (proxy.ts): o script do next-themes que evita o piscar do tema precisa dele
  const nonce = (await headers()).get("x-nonce") ?? undefined
  return (
    <html
      lang="pt-BR"
      suppressHydrationWarning
      className={cn(
        "antialiased",
        fontSans.variable,
        fontMono.variable,
        "font-sans"
      )}
    >
      <body>
        {/* tema claro é o padrão (§14.1); o escuro é preferência do usuário */}
        <ThemeProvider defaultTheme="light" enableSystem={false} nonce={nonce}>
          <TooltipProvider delay={120}>{children}</TooltipProvider>
        </ThemeProvider>
        {/* só coletam na Vercel; localmente não carregam nada */}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  )
}
