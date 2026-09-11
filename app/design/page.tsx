import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { Vitrine } from "@/components/cadencia/vitrine"

export const metadata: Metadata = { title: "Vitrine" }

// Vitrine do design system (E01): só em desenvolvimento e nos previews da Vercel.
export default function Page() {
  if (process.env.NODE_ENV === "production" && process.env.VERCEL_ENV !== "preview") notFound()
  return <Vitrine />
}
