import { cn } from "@/lib/utils"

// Cabeçalho de seção (.sec-cab): título 14px e linha de apoio, agrupamento por régua, sem card.
export function SecaoCabecalho({
  titulo,
  apoio,
  className,
}: {
  titulo: React.ReactNode
  apoio?: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        "mb-3.5 flex flex-wrap items-center justify-between gap-4 border-b pb-[9px]",
        className
      )}
    >
      <h2 className="text-sm font-semibold tracking-[-0.01em]">{titulo}</h2>
      {apoio ? (
        <span className="flex flex-wrap items-center gap-[9px] text-xs text-muted-foreground">
          {apoio}
        </span>
      ) : null}
    </div>
  )
}
