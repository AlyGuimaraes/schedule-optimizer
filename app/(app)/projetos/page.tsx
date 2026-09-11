import type { Metadata } from "next"

import { TelaProjetos } from "@/components/telas/projetos"

export const metadata: Metadata = { title: "Projetos" }

export default function Page() {
  return <TelaProjetos />
}
