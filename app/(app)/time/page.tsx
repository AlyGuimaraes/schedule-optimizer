import type { Metadata } from "next"

import { TelaTime } from "@/components/telas/time"

export const metadata: Metadata = { title: "Time" }

export default function Page() {
  return <TelaTime />
}
