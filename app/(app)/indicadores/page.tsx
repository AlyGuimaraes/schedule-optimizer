import type { Metadata } from "next"

import { TelaPendente } from "@/components/cadencia/tela-pendente"

export const metadata: Metadata = { title: "Indicadores" }

export default function Page() {
  return <TelaPendente slug="indicadores" />
}
