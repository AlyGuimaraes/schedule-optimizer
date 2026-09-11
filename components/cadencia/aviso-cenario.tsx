"use client"

import { useCadencia } from "@/lib/estado/cadencia"

// Faixa sob o cabeçalho enquanto um cenário salvo está no alternador global (E13):
// as telas mostram as premissas dele, mas edições continuam gravando nas premissas atuais.
export function AvisoCenario() {
  const ativo = useCadencia((s) => s.cenarioAtivo)
  const aplicar = useCadencia((s) => s.aplicarCenario)
  if (!ativo) return null
  return (
    <div role="status" className="flex items-center gap-3 border-b bg-accent px-5 py-1.5 text-xs text-accent-foreground">
      <span className="min-w-0 truncate">
        Você está vendo o cenário <b>{ativo.nome}</b>, com as premissas dele sobre o mundo atual. Edições gravam nas
        premissas atuais.
      </span>
      <button
        type="button"
        className="ml-auto shrink-0 font-medium underline underline-offset-2"
        onClick={() => aplicar(null)}
      >
        Voltar às premissas atuais
      </button>
    </div>
  )
}
