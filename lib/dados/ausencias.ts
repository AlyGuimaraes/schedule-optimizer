"use server"

import { revalidatePath } from "next/cache"

import { clienteAdmin } from "./admin"
import type { TipoAusencia } from "./mapeador"
import type { Resultado } from "./tipos-acoes"

// Ausências e feriados (E14): cadastro manual até a integração com o RH (E23).
// Um dia fora tira a pessoa da agenda daquele dia e encolhe o teto da semana na mesma proporção.

const TIPOS: TipoAusencia[] = ["ferias", "ausencia", "feriado_nacional", "feriado_municipal"]
const DATA = /^\d{4}-\d{2}-\d{2}$/

const erroDe = (e: unknown) => (e instanceof Error ? e.message : String(e))

export interface AusenciaEntrada {
  id?: string | null
  /** nula: feriado, vale para todos */
  pessoaId: string | null
  inicio: string
  fim: string
  tipo: TipoAusencia
  descricao: string
}

export async function salvarAusencia(e: AusenciaEntrada): Promise<Resultado> {
  try {
    if (!TIPOS.includes(e.tipo)) throw new Error("Tipo de ausência inválido.")
    if (!DATA.test(e.inicio) || !DATA.test(e.fim)) throw new Error("Informe as datas de início e fim.")
    if (e.fim < e.inicio) throw new Error("A data final vem antes da inicial.")
    const feriado = e.tipo === "feriado_nacional" || e.tipo === "feriado_municipal"
    if (!feriado && !e.pessoaId) throw new Error("Escolha a pessoa. Só feriado vale para todos.")
    const linha = {
      pessoa_id: feriado ? null : e.pessoaId,
      inicio: e.inicio,
      fim: e.fim,
      tipo: e.tipo,
      descricao: e.descricao.trim().slice(0, 120),
    }
    const sb = clienteAdmin()
    const r = e.id ? await sb.from("ausencias").update(linha).eq("id", e.id) : await sb.from("ausencias").insert(linha)
    if (r.error) throw new Error(r.error.message.includes("check constraint") ? "Período acima de 120 dias ou inválido." : r.error.message)
    revalidatePath("/", "layout")
    return { ok: true, dados: null }
  } catch (err) {
    return { ok: false, erro: erroDe(err) }
  }
}

export async function excluirAusencia(id: string): Promise<Resultado> {
  try {
    const r = await clienteAdmin().from("ausencias").delete().eq("id", id)
    if (r.error) throw new Error(r.error.message)
    revalidatePath("/", "layout")
    return { ok: true, dados: null }
  } catch (err) {
    return { ok: false, erro: erroDe(err) }
  }
}
