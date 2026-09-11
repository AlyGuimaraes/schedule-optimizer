"use client"

import * as React from "react"
import { usePathname, useRouter } from "next/navigation"
import { CheckIcon, ChevronDownIcon, MoonIcon, PlayIcon, SunIcon } from "lucide-react"
import { useTheme } from "next-themes"

import { Segmentado } from "@/components/cadencia/segmentado"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { SidebarTrigger, useSidebar } from "@/components/ui/sidebar"
import { listarCenarios } from "@/lib/dados/cenarios"
import type { CenarioLista } from "@/lib/dados/tipos-acoes"
import { useCadencia, type Cenario } from "@/lib/estado/cadencia"
import { telaDoCaminho } from "@/lib/navegacao"

const CENARIOS: { valor: Cenario; rotulo: string }[] = [
  { valor: "base", rotulo: "Agenda atual" },
  { valor: "otm", rotulo: "Otimizada" },
]

const assinarNada = () => () => {}

// Seletor do cenário comparado pelo alternador (E13): premissas atuais ou as de um cenário salvo.
function SeletorCenario() {
  const ativo = useCadencia((s) => s.cenarioAtivo)
  const aplicar = useCadencia((s) => s.aplicarCenario)
  const [lista, setLista] = React.useState<CenarioLista[] | null>(null)
  const aoAbrir = (aberto: boolean) => {
    if (aberto) void listarCenarios().then((r) => setLista(r.ok ? r.dados.filter((c) => c.premissas) : []))
  }
  return (
    <DropdownMenu onOpenChange={aoAbrir}>
      <DropdownMenuTrigger
        render={
          <Button
            variant={ativo ? "secondary" : "ghost"}
            size="sm"
            className="max-w-44 gap-1 px-2 text-xs font-medium"
            aria-label="Escolher o cenário comparado"
          />
        }
      >
        <span className="truncate">{ativo ? ativo.nome : "Premissas atuais"}</span>
        <ChevronDownIcon className="size-3.5 opacity-60" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Comparar a agenda atual com</DropdownMenuLabel>
          <DropdownMenuItem onClick={() => aplicar(null)}>
            Premissas atuais
            {ativo ? null : <CheckIcon className="ml-auto" />}
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuLabel>Cenários salvos</DropdownMenuLabel>
          {lista === null ? (
            <DropdownMenuItem disabled>carregando</DropdownMenuItem>
          ) : lista.length === 0 ? (
            <DropdownMenuItem disabled>nenhum ainda; salve um no Otimizador</DropdownMenuItem>
          ) : (
            lista.map((c) => (
              <DropdownMenuItem
                key={c.id}
                onClick={() => aplicar({ id: c.id, nome: c.nome, premissas: c.premissas ?? {} })}
              >
                <span className="min-w-0 truncate">{c.nome}</span>
                <span className="ml-auto shrink-0 font-mono text-[10.5px] text-muted-foreground">
                  {c.status === "publicado" ? "vigente" : `${c.horizonte} sem.`}
                </span>
                {ativo?.id === c.id ? <CheckIcon /> : null}
              </DropdownMenuItem>
            ))
          )}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

// Site header de 64px do protótipo: gatilho do menu, separador, título e subtítulo da tela,
// linha de estado do solver, cenário, tema e o botão Otimizar.
export function SiteHeader() {
  const pathname = usePathname()
  const router = useRouter()
  const tela = telaDoCaminho(pathname)
  const cenario = useCadencia((s) => s.cenario)
  const setCenario = useCadencia((s) => s.setCenario)
  const estado = useCadencia((s) => s.estado)
  const otimizar = useCadencia((s) => s.otimizar)
  const pronto = useCadencia((s) => s.simulacao !== null)
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
        <SeletorCenario />
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
          disabled={!pronto}
          onClick={() => {
            if (pathname !== "/otimizador") router.push("/otimizador")
            void otimizar()
          }}
        >
          <PlayIcon data-icon="inline-start" className="size-3.5" />
          Otimizar
        </Button>
      </div>
    </header>
  )
}
