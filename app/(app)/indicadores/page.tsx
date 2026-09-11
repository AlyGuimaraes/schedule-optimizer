import type { Metadata } from "next"

import { TelaIndicadores } from "@/components/telas/indicadores"

export const metadata: Metadata = { title: "Indicadores" }

export default function Page() {
  return <TelaIndicadores />
}
