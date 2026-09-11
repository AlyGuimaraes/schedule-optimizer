import type { Metadata } from "next"

import { TelaPendente } from "@/components/cadencia/tela-pendente"

export const metadata: Metadata = { title: "Otimizador" }

export default function Page() {
  return <TelaPendente slug="otimizador" />
}
