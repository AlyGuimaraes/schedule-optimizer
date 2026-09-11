import type { Metadata } from "next"

import { TelaOtimizador } from "@/components/telas/otimizador"

export const metadata: Metadata = { title: "Otimizador" }

export default function Page() {
  return <TelaOtimizador />
}
