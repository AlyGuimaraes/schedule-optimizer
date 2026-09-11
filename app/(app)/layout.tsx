import { cookies } from "next/headers"

import { AppSidebar } from "@/components/cadencia/app-sidebar"
import { AvisoCenario } from "@/components/cadencia/aviso-cenario"
import { CadenciaProvider } from "@/components/cadencia/cadencia-provider"
import { DicaFlutuante } from "@/components/cadencia/dica-flutuante"
import { SiteHeader } from "@/components/cadencia/site-header"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { carregarMundo } from "@/lib/dados/mundo"

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [cookieStore, carga] = await Promise.all([cookies(), carregarMundo()])
  // o SidebarProvider grava o estado do menu neste cookie
  const aberto = cookieStore.get("sidebar_state")?.value !== "false"

  return (
    <SidebarProvider defaultOpen={aberto}>
      <CadenciaProvider dados={carga.dados} erro={carga.erro}>
        <AppSidebar />
        <SidebarInset className="min-w-0">
          <SiteHeader />
          <AvisoCenario />
          {children}
        </SidebarInset>
        <DicaFlutuante />
      </CadenciaProvider>
    </SidebarProvider>
  )
}
