// Logs estruturados (E17): uma linha JSON por evento, fácil de filtrar nos logs da Vercel.
// Sem dado pessoal: vai o nome do evento e o texto do erro, nunca a entrada da ação.

type Nivel = "info" | "aviso" | "erro"
type Valor = string | number | boolean | null | undefined

export function registrar(nivel: Nivel, evento: string, dados: Record<string, Valor> = {}): void {
  const linha = JSON.stringify({ t: new Date().toISOString(), app: "cadencia", nivel, evento, ...dados })
  if (nivel === "erro") console.error(linha)
  else if (nivel === "aviso") console.warn(linha)
  else console.info(linha)
}
