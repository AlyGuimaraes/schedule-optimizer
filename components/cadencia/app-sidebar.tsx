"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import { GRUPOS, TELAS } from "@/lib/navegacao"

// Rail do protótipo sobre a anatomia oficial: 16rem expandida, 3rem recolhida,
// header de 48px com quadrado de 32px em sidebar-primary, rótulo em tooltip quando recolhida.
export function AppSidebar() {
  const pathname = usePathname()

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              tooltip="Cadência, LeverPro"
              render={<Link href="/cockpit" />}
            >
              <span
                aria-hidden
                className="grid size-8 shrink-0 place-items-center rounded-lg bg-sidebar-primary text-[13px] font-semibold text-sidebar-primary-foreground"
              >
                C
              </span>
              <span className="grid min-w-0 leading-tight">
                <b className="truncate text-[13px] font-semibold">Cadência</b>
                <span className="truncate text-[11.5px] text-muted-foreground">
                  LeverPro
                </span>
              </span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <nav aria-label="Seções">
          {GRUPOS.map((grupo) => (
            <SidebarGroup key={grupo} className="py-0">
              <SidebarGroupLabel>{grupo}</SidebarGroupLabel>
              <SidebarMenu className="gap-0.5">
                {TELAS.filter((tela) => tela.grupo === grupo).map((tela) => {
                  const ativo =
                    pathname === tela.href ||
                    pathname.startsWith(`${tela.href}/`)
                  return (
                    <SidebarMenuItem key={tela.slug}>
                      <SidebarMenuButton
                        isActive={ativo}
                        tooltip={tela.titulo}
                        className="text-[13.5px]"
                        render={
                          <Link
                            href={tela.href}
                            aria-current={ativo ? "page" : undefined}
                          />
                        }
                      >
                        <tela.icone />
                        <span>{tela.titulo}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )
                })}
              </SidebarMenu>
            </SidebarGroup>
          ))}
        </nav>
      </SidebarContent>

      <SidebarFooter>
        <div className="overflow-hidden rounded-md bg-sidebar-accent px-3 py-2.5 font-mono text-[10.5px] leading-[1.6] whitespace-nowrap text-muted-foreground group-data-[collapsible=icon]:hidden">
          perfil equilibrio
          <br />
          horizonte de 4 semanas
          <br />
          motor na etapa E02
        </div>
      </SidebarFooter>
    </Sidebar>
  )
}
