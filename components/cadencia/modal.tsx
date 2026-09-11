"use client"

import * as React from "react"
import { createPortal } from "react-dom"

/**
 * Modal do protótipo (§14.5): escurecimento, fecha por Esc, clique fora e X, trava a rolagem
 * e leva o foco para o primeiro campo. Editores e confirmações usam o mesmo componente.
 */
export function Modal({
  aberto,
  largura = 520,
  onFechar,
  rotulo,
  children,
}: {
  aberto: boolean
  largura?: number
  onFechar: () => void
  rotulo?: string
  children: React.ReactNode
}) {
  const caixa = React.useRef<HTMLDivElement>(null)
  const fechar = React.useRef(onFechar)
  React.useEffect(() => {
    fechar.current = onFechar
  }, [onFechar])

  React.useEffect(() => {
    if (!aberto) return
    const anterior = document.body.style.overflow
    document.body.style.overflow = "hidden"
    const primeiro = caixa.current?.querySelector<HTMLElement>(
      "input:not([disabled]), select:not([disabled]), textarea, button.btn"
    )
    primeiro?.focus()
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault()
        fechar.current()
      }
    }
    document.addEventListener("keydown", aoTeclar)
    return () => {
      document.body.style.overflow = anterior
      document.removeEventListener("keydown", aoTeclar)
    }
  }, [aberto])

  if (!aberto || typeof document === "undefined") return null

  return createPortal(
    <div
      className="fundo cad"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) fechar.current()
      }}
    >
      <div
        ref={caixa}
        className="caixa"
        role="dialog"
        aria-modal="true"
        aria-label={rotulo}
        style={{ maxWidth: largura }}
      >
        <button type="button" className="fechar-x" aria-label="Fechar" onClick={() => fechar.current()}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" aria-hidden="true">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
        <div className="editor">{children}</div>
      </div>
    </div>,
    document.body
  )
}

export function EditorCab({ titulo, meta }: { titulo: string; meta?: React.ReactNode }) {
  return (
    <div className="editor-cab">
      <h3>{titulo}</h3>
      {meta ? <span className="meta">{meta}</span> : null}
    </div>
  )
}

export function EditorPe({
  erro,
  acao,
  perigo = false,
  ocupado = false,
  onCancelar,
  onAcao,
}: {
  erro?: string | null
  acao: string
  perigo?: boolean
  ocupado?: boolean
  onCancelar: () => void
  onAcao: () => void
}) {
  return (
    <div className="editor-pe">
      {erro ? <span className="msg" role="alert">{erro}</span> : null}
      <button type="button" className="mini-btn" onClick={onCancelar}>
        Cancelar
      </button>
      <button type="button" className={perigo ? "btn perigo" : "btn"} disabled={ocupado} onClick={onAcao}>
        {ocupado ? "Salvando" : acao}
      </button>
    </div>
  )
}

/** Confirmação: sempre diz a consequência antes (§14.5). */
export function Confirmacao({
  aberto,
  titulo,
  texto,
  acao,
  perigo = true,
  extra,
  erro,
  ocupado,
  onConfirmar,
  onFechar,
}: {
  aberto: boolean
  titulo: string
  texto: React.ReactNode
  acao: string
  perigo?: boolean
  extra?: React.ReactNode
  erro?: string | null
  ocupado?: boolean
  onConfirmar: () => void
  onFechar: () => void
}) {
  return (
    <Modal aberto={aberto} largura={520} onFechar={onFechar} rotulo={titulo}>
      <EditorCab titulo={titulo} />
      <p className="nota">{texto}</p>
      {extra}
      <EditorPe erro={erro} acao={acao} perigo={perigo} ocupado={ocupado} onCancelar={onFechar} onAcao={onConfirmar} />
    </Modal>
  )
}
