"use client"

import * as React from "react"

export type Cenario = "base" | "otm"

type Estado = { texto: string; vivo: boolean }

type CenarioContexto = {
  cenario: Cenario
  setCenario: (cenario: Cenario) => void
  /** linha de estado do cabeçalho, em mono 10.5px, como no protótipo */
  estado: Estado
  avisar: (texto: string) => void
}

// Enquanto o motor não é portado (E02), a linha de estado não tem o tempo do solver.
const ESTADO_OCIOSO: Estado = { texto: "motor pendente", vivo: false }

const Contexto = React.createContext<CenarioContexto | null>(null)

export function CenarioProvider({ children }: { children: React.ReactNode }) {
  const [cenario, setCenario] = React.useState<Cenario>("otm")
  const [estado, setEstado] = React.useState<Estado>(ESTADO_OCIOSO)
  const timer = React.useRef<ReturnType<typeof setTimeout>>(undefined)

  const avisar = React.useCallback((texto: string) => {
    setEstado({ texto, vivo: true })
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setEstado(ESTADO_OCIOSO), 2400)
  }, [])

  React.useEffect(() => () => clearTimeout(timer.current), [])

  const valor = React.useMemo(
    () => ({ cenario, setCenario, estado, avisar }),
    [cenario, estado, avisar]
  )

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>
}

export function useCenario() {
  const contexto = React.useContext(Contexto)
  if (!contexto) throw new Error("useCenario precisa de CenarioProvider")
  return contexto
}
