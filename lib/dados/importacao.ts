"use server"

import { revalidatePath } from "next/cache"

import {
  linhasParaGravar,
  validarEventos,
  validarJanela,
  type EventoImportado,
  type JanelaImportacao,
  type ResumoImportacao,
} from "@/lib/calendario/importacao"

import { clienteAdmin } from "./admin"
import type { Resultado } from "./tipos-acoes"

// Importação da agenda atual por .ics (E09), a alternativa sem integração com o Outlook. O arquivo
// é lido no navegador (lib/calendario/ics.ts): aqui chegam só eventos normalizados, sem título.
// Reimportar é idempotente: grava por (pessoa, provedor, id externo) e depois tira da janela o que
// a importação anterior tinha e esta não trouxe. Nessa ordem, uma falha no meio nunca apaga a agenda.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const LOTE = 500

const erroDe = (e: unknown) => (e instanceof Error ? e.message : String(e))

export async function importarIcs(
  pessoaId: string,
  eventos: EventoImportado[],
  janela: JanelaImportacao
): Promise<Resultado<{ gravados: number; removidos: number }>> {
  try {
    if (!UUID.test(pessoaId)) throw new Error("Escolha a pessoa.")
    const j = validarJanela(janela)
    const limpos = validarEventos(eventos, j)
    const inicio = new Date(j.inicio).toISOString()
    const fim = new Date(j.fim).toISOString()
    const sb = clienteAdmin()

    const imp = await sb
      .from("importacoes_agenda")
      .insert({ pessoa_id: pessoaId, provedor: "ics", janela_inicio: inicio, janela_fim: fim, eventos: limpos.length })
      .select("id")
      .single()
    if (imp.error) throw new Error(imp.error.message)

    const linhas = linhasParaGravar(pessoaId, imp.data.id, limpos)
    for (let i = 0; i < linhas.length; i += LOTE) {
      const r = await sb
        .from("eventos_externos")
        .upsert(linhas.slice(i, i + LOTE), { onConflict: "pessoa_id,provedor,external_id" })
      if (r.error) throw new Error(r.error.message)
    }

    const antigos = await sb
      .from("eventos_externos")
      .delete({ count: "exact" })
      .eq("pessoa_id", pessoaId)
      .eq("provedor", "ics")
      .lt("inicio", fim)
      .gt("fim", inicio)
      .or(`importacao_id.is.null,importacao_id.neq.${imp.data.id}`)
    if (antigos.error) throw new Error(antigos.error.message)

    revalidatePath("/", "layout")
    return { ok: true, dados: { gravados: linhas.length, removidos: antigos.count ?? 0 } }
  } catch (err) {
    return { ok: false, erro: erroDe(err) }
  }
}

/** Tira da pessoa todos os eventos importados por .ics e o histórico dessas importações. */
export async function limparImportacao(pessoaId: string): Promise<Resultado<{ removidos: number }>> {
  try {
    if (!UUID.test(pessoaId)) throw new Error("Escolha a pessoa.")
    const sb = clienteAdmin()
    const r = await sb.from("eventos_externos").delete({ count: "exact" }).eq("pessoa_id", pessoaId).eq("provedor", "ics")
    if (r.error) throw new Error(r.error.message)
    const h = await sb.from("importacoes_agenda").delete().eq("pessoa_id", pessoaId).eq("provedor", "ics")
    if (h.error) throw new Error(h.error.message)
    revalidatePath("/", "layout")
    return { ok: true, dados: { removidos: r.count ?? 0 } }
  } catch (err) {
    return { ok: false, erro: erroDe(err) }
  }
}

interface LinhaResumo {
  pessoa_id: string
  provedor: string
  cerimonia: number
  institucional: number
  opaco: number
  janela_inicio: string | null
  janela_fim: string | null
  importado_em: string | null
}

/** Por pessoa e provedor: eventos por classificação e a última importação (RPC `resumo_importacoes`). */
export async function resumoImportacoes(): Promise<Resultado<ResumoImportacao[]>> {
  try {
    const r = await clienteAdmin().rpc("resumo_importacoes")
    if (r.error) throw new Error(r.error.message)
    const linhas = (Array.isArray(r.data) ? r.data : []) as unknown as LinhaResumo[]
    return {
      ok: true,
      dados: linhas.map((l) => ({
        pessoaId: l.pessoa_id,
        provedor: l.provedor,
        cerimonia: Number(l.cerimonia) || 0,
        institucional: Number(l.institucional) || 0,
        opaco: Number(l.opaco) || 0,
        janelaInicio: l.janela_inicio,
        janelaFim: l.janela_fim,
        importadoEm: l.importado_em,
      })),
    }
  } catch (err) {
    return { ok: false, erro: erroDe(err) }
  }
}
