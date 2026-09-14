import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { Vitrine } from "@/components/cadencia/vitrine"

export const metadata: Metadata = { title: "Vitrine" }

// Vitrine do design system (E01): só em desenvolvimento, nos previews da Vercel e no CI (VITRINE=1).
export default function Page() {
  const liberada = process.env.NODE_ENV !== "production" || process.env.VERCEL_ENV === "preview" || process.env.VITRINE === "1"
  if (!liberada) notFound()
  return <Vitrine />
}
