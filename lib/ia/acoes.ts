"use server"

import { narrar } from "./agentes/narrador"
import { iaDisponivel } from "./cliente"
import type { Narracao } from "./contratos/narrador"
import { EntradaNarradorSchema, type EntradaNarrador } from "./entradas"

// Server actions da camada de IA. São alcançáveis por POST direto: a entrada é validada aqui e,
// sem chave, nada é chamado. Autenticação e limite de taxa entram com o login (E03) e o
// hardening (E17), antes de ativar a chave em produção.

/**
 * Narra o resultado do Otimizador. Devolve null sem chave, com entrada inválida ou quando a IA
 * não respondeu; nesses casos a tela continua com a leitura determinística.
 */
export async function narrarResultado(entrada: EntradaNarrador): Promise<Narracao | null> {
  if (!iaDisponivel()) return null
  const valida = EntradaNarradorSchema.safeParse(entrada)
  if (!valida.success) return null
  const narracao = await narrar(valida.data)
  return narracao.origem === "ia" ? narracao : null
}
