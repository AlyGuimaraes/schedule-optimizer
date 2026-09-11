import { Fragment } from "react"

import type { TrechoLeitura } from "@/lib/ia/leitura-deterministica"

/** Trechos da leitura determinística, com os destaques em negrito. */
export function TextoLeitura({ trechos }: { trechos: TrechoLeitura[] }) {
  return (
    <>
      {trechos.map((t, i) => (t.destaque ? <b key={i}>{t.texto}</b> : <Fragment key={i}>{t.texto}</Fragment>))}
    </>
  )
}
