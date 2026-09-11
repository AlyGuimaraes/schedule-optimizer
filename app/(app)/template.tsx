// O template remonta a cada navegação, então a entrada em cascata (.entra) roda em toda troca de tela.
export default function Template({ children }: { children: React.ReactNode }) {
  return (
    <div id="tela" tabIndex={-1} className="entra px-6 pt-5 pb-16 outline-none">
      {children}
    </div>
  )
}
