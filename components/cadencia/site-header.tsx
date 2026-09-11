"use client"

import * as React from "react"
import { usePathname } from "next/navigation"
import { MoonIcon, PlayIcon, SunIcon } from "lucide-react"
import { useTheme } from "next-themes"

import { useCenario, type Cenario } from "@/components/cadencia/cenario-provider"
import { Segmentado } from "@/components/cadencia/segmentado"
import { Button } from "@/components/ui/button"
import { SidebarTrigger, useSidebar } from "@/components/ui/sidebar"
import { telaDoCaminho } from "@/lib/navegacao"

const CENARIOS: { valor: Cenario; rotulo: string }[] = [
  { valor: "base", rotulo: "Agenda atual" },
  { valor: "otm", rotulo: "Otimizada" },
]

const assinarNada = () => () => {}

// Site header de 64px do protótipo: gatilho do menu, separador, título e subtítulo da tela,
// linha de estado do solver, cenário, tema e o botão Otimizar.
export function SiteHeader() {
  const tela = telaDoCaminho(usePathname())
  const { cenario, setCenario, estado, avisar } = useCenario()
  const { state } = useSidebar()
  const { resolvedTheme, setTheme } = useTheme()
  const montado = React.useSyncExternalStore(
    assinarNada,
    () => true,
    () => false
  )
  const escuro = montado && resolvedTheme === "dark"
  const rotuloMenu = state === "collapsed" ? "Expandir menu" : "Recolher menu"
  const rotuloTema = escuro ? "Ativar modo claro" : "Ativar modo escuro"

  return (
    <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center gap-2.5 border-b bg-background px-5">
      <SidebarTrigger aria-label={rotuloMenu} title={rotuloMenu} />
      <div role="none" className="h-4 w-px shrink-0 bg-border" />
      <div className="min-w-0">
        <h1 className="text-[17px] leading-tight font-semibold tracking-[-0.02em]">
          {tela.titulo}
        </h1>
        <p className="truncate text-xs text-muted-foreground">
          {tela.subtitulo}
        </p>
      </div>

      <div className="ml-auto flex items-center gap-2">
        <span
          aria-live="polite"
          data-vivo={estado.vivo}
          className="hidden font-mono text-[10.5px] whitespace-nowrap text-muted-foreground transition-colors duration-150 data-[vivo=true]:text-primary md:inline"
        >
          {estado.texto}
        </span>
        <Segmentado
          rotulo="Cenário"
          valor={cenario}
          opcoes={CENARIOS}
          onChange={setCenario}
        />
        <Button
          variant="ghost"
          size="icon"
          aria-label={rotuloTema}
          title={escuro ? "Modo claro" : "Modo escuro"}
          onClick={() => setTheme(escuro ? "light" : "dark")}
        >
          {escuro ? <SunIcon /> : <MoonIcon />}
        </Button>
        <Button
          className="px-3.5 text-[12.5px] shadow-xs"
          onClick={() =>
            avisar("o motor de otimização chega na etapa E02, a tela na E12")
          }
        >
          <PlayIcon data-icon="inline-start" className="size-3.5" />
          Otimizar
        </Button>
      </div>
    </header>
  )
}
