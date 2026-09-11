import type { Metadata } from "next"

import { TelaCockpit } from "@/components/telas/cockpit"

export const metadata: Metadata = { title: "Cockpit" }

export default function Page() {
  return <TelaCockpit />
}
