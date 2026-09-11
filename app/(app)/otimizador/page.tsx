import type { Metadata } from "next"

import { TelaOtimizador } from "@/components/telas/otimizador"
import { iaDisponivel } from "@/lib/ia/cliente"

export const metadata: Metadata = { title: "Otimizador" }

export default function Page() {
  // só o booleano cruza para o cliente: sem chave, a tela nem chama o Narrador
  return <TelaOtimizador narradorIa={iaDisponivel()} />
}
