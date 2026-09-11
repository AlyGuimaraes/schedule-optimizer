"use client"

import { useCallback } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"

/**
 * Estado de interface na URL (abas, escala, filtros), para links compartilháveis.
 * O valor padrão não aparece na URL.
 */
export function useParametro<T extends string>(
  nome: string,
  padrao: T,
  permitidos?: readonly T[]
): [T, (valor: T) => void] {
  const params = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const bruto = params.get(nome) as T | null
  const valor = bruto && (!permitidos || permitidos.includes(bruto)) ? bruto : padrao

  const definir = useCallback(
    (novo: T) => {
      const p = new URLSearchParams(params.toString())
      if (novo === padrao) p.delete(nome)
      else p.set(nome, novo)
      const q = p.toString()
      router.replace(`${pathname}${q ? `?${q}` : ""}`, { scroll: false })
    },
    [params, router, pathname, nome, padrao]
  )

  return [valor, definir]
}

/** Lista de ids numéricos na URL (`?pessoas=1,4,7`). Vazio significa todos. */
export function useListaParametro(
  nome: string,
  padrao: number[] = []
): [number[], (valor: number[]) => void] {
  const params = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const bruto = params.get(nome)
  const valor =
    bruto === null
      ? padrao
      : bruto === ""
        ? []
        : bruto
            .split(",")
            .map(Number)
            .filter((n) => Number.isInteger(n) && n >= 0)

  const definir = useCallback(
    (novo: number[]) => {
      const p = new URLSearchParams(params.toString())
      p.set(nome, novo.join(","))
      router.replace(`${pathname}?${p.toString()}`, { scroll: false })
    },
    [params, router, pathname, nome]
  )

  return [valor, definir]
}
