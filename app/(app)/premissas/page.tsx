import type { Metadata } from "next"

import { TelaPremissas } from "@/components/telas/premissas"

export const metadata: Metadata = { title: "Premissas" }

export default function Page() {
  return <TelaPremissas />
}
