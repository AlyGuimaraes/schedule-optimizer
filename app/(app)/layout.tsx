import { cookies } from "next/headers"

import { AppSidebar } from "@/components/cadencia/app-sidebar"
import { CenarioProvider } from "@/components/cadencia/cenario-provider"
import { SiteHeader } from "@/components/cadencia/site-header"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // o SidebarProvider grava o estado do menu neste cookie
  const aberto = (await cookies()).get("sidebar_state")?.value !== "false"

  return (
    <SidebarProvider defaultOpen={aberto}>
      <CenarioProvider>
        <AppSidebar />
        <SidebarInset className="min-w-0">
          <SiteHeader />
          {children}
        </SidebarInset>
      </CenarioProvider>
    </SidebarProvider>
  )
}
