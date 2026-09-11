"use client"

import { cn } from "@/lib/utils"

type Opcao<T extends string> = { valor: T; rotulo: string }

// Alternador segmentado (.seg do protótipo): trilho muted, item ativo em background com shadow-xs.
export function Segmentado<T extends string>({
  rotulo,
  valor,
  opcoes,
  onChange,
  compacto = false,
  className,
}: {
  rotulo: string
  valor: T
  opcoes: Opcao<T>[]
  onChange: (valor: T) => void
  compacto?: boolean
  className?: string
}) {
  return (
    <div
      role="group"
      aria-label={rotulo}
      className={cn(
        "inline-flex rounded-lg bg-muted p-[3px]",
        compacto ? "h-[30px]" : "h-8",
        className
      )}
    >
      {opcoes.map((opcao) => (
        <button
          key={opcao.valor}
          type="button"
          aria-pressed={opcao.valor === valor}
          onClick={() => onChange(opcao.valor)}
          className={cn(
            "rounded-md font-medium text-muted-foreground transition-[background-color,color] duration-150 ease-cadencia aria-pressed:bg-background aria-pressed:text-foreground aria-pressed:shadow-xs",
            compacto ? "px-2.5 text-[11.5px]" : "px-[11px] text-xs"
          )}
        >
          {opcao.rotulo}
        </button>
      ))}
    </div>
  )
}
