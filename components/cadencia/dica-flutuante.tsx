"use client"

import * as React from "react"

/**
 * Dica flutuante do protótipo (.dica-flut): qualquer elemento com `data-dica` mostra o texto
 * ao passar o mouse, em fundo primary. Um único listener no documento atende a tela inteira.
 */
export function DicaFlutuante() {
  const ref = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    const dica = ref.current
    if (!dica) return

    function mostrar(e: MouseEvent) {
      const alvo = (e.target as Element | null)?.closest?.("[data-dica]") as HTMLElement | SVGElement | null
      if (!alvo || !dica) {
        if (dica) dica.dataset.ver = "0"
        return
      }
      dica.textContent = alvo.getAttribute("data-dica") ?? ""
      dica.dataset.ver = "1"
      dica.style.left = `${Math.min(e.clientX + 12, window.innerWidth - 262)}px`
      dica.style.top = `${e.clientY + 15}px`
    }
    function esconder(e: MouseEvent) {
      const destino = (e.relatedTarget as Element | null)?.closest?.("[data-dica]")
      if (!destino && dica) dica.dataset.ver = "0"
    }

    document.addEventListener("mouseover", mostrar)
    document.addEventListener("mouseout", esconder)
    return () => {
      document.removeEventListener("mouseover", mostrar)
      document.removeEventListener("mouseout", esconder)
    }
  }, [])

  return <div ref={ref} className="dica-flut" role="tooltip" />
}
