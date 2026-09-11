"use client"

import * as React from "react"

const ID_DICA = "dica-flutuante"

/**
 * Dica flutuante do protótipo (.dica-flut): qualquer elemento com `data-dica` mostra o texto
 * ao passar o mouse ou receber foco, em fundo primary. Um único listener no documento atende a
 * tela inteira. Enquanto visível, o alvo aponta para a dica com `aria-describedby` (padrão ARIA
 * de tooltip); escondida, a dica sai da árvore de acessibilidade.
 */
export function DicaFlutuante() {
  const ref = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    const dica = ref.current
    if (!dica) return
    let alvoAtual: Element | null = null

    function esconderDica() {
      if (!dica) return
      dica.dataset.ver = "0"
      dica.setAttribute("aria-hidden", "true")
      alvoAtual?.removeAttribute("aria-describedby")
      alvoAtual = null
    }

    function mostrarEm(alvo: Element, x: number, y: number) {
      if (!dica) return
      if (alvoAtual && alvoAtual !== alvo) alvoAtual.removeAttribute("aria-describedby")
      dica.textContent = alvo.getAttribute("data-dica") ?? ""
      dica.dataset.ver = "1"
      dica.removeAttribute("aria-hidden")
      dica.style.left = `${Math.min(x + 12, window.innerWidth - 262)}px`
      dica.style.top = `${y + 15}px`
      alvo.setAttribute("aria-describedby", ID_DICA)
      alvoAtual = alvo
    }

    const alvoDe = (t: EventTarget | null) => (t as Element | null)?.closest?.("[data-dica]") ?? null

    function mouseEntra(e: MouseEvent) {
      const alvo = alvoDe(e.target)
      if (alvo) mostrarEm(alvo, e.clientX, e.clientY)
      else esconderDica()
    }
    function mouseSai(e: MouseEvent) {
      if (!alvoDe(e.relatedTarget)) esconderDica()
    }
    function focoEntra(e: FocusEvent) {
      const alvo = alvoDe(e.target)
      if (!alvo) return
      const r = alvo.getBoundingClientRect()
      mostrarEm(alvo, r.left, r.bottom - 10)
    }
    function focoSai() {
      esconderDica()
    }

    document.addEventListener("mouseover", mouseEntra)
    document.addEventListener("mouseout", mouseSai)
    document.addEventListener("focusin", focoEntra)
    document.addEventListener("focusout", focoSai)
    return () => {
      document.removeEventListener("mouseover", mouseEntra)
      document.removeEventListener("mouseout", mouseSai)
      document.removeEventListener("focusin", focoEntra)
      document.removeEventListener("focusout", focoSai)
    }
  }, [])

  return <div ref={ref} id={ID_DICA} className="dica-flut" role="tooltip" aria-hidden="true" />
}
