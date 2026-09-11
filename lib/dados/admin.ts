import "server-only"

import { createClient } from "@supabase/supabase-js"

import type { Database } from "./tipos-banco"

/**
 * Cliente com a service role, só no servidor.
 * Temporário: enquanto o login da E03 não existe, as leituras do servidor passam por aqui.
 * Quando o login entrar, as telas passam a usar o cliente da sessão e o RLS por papel.
 */
export function clienteAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const chave = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !chave) {
    throw new Error(
      "Defina NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY para carregar o mundo do banco."
    )
  }
  return createClient<Database>(url, chave, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}
