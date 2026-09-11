import { cn } from "@/lib/utils"

// Estado vazio (.vazio do protótipo): borda tracejada, ícone em quadrado muted de 40px,
// título e explicação do porquê está vazio e do que fazer.
export function Vazio({
  icone,
  titulo,
  children,
  acao,
  className,
}: {
  icone: React.ReactNode
  titulo: React.ReactNode
  children?: React.ReactNode
  acao?: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed px-6 py-10 text-center text-[12.5px] text-balance text-muted-foreground",
        className
      )}
    >
      <div className="mb-1.5 grid size-10 place-items-center rounded-lg bg-muted text-muted-foreground [&_svg]:size-5 [&_svg]:stroke-[1.8]">
        {icone}
      </div>
      <b className="block text-sm font-medium text-foreground">{titulo}</b>
      {children}
      {acao ? <div className="mt-3">{acao}</div> : null}
    </div>
  )
}
