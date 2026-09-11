import { SecaoCabecalho } from "@/components/cadencia/secao-cabecalho"
import { Vazio } from "@/components/cadencia/vazio"
import { telaPorSlug } from "@/lib/navegacao"

// Placeholder das telas enquanto a etapa correspondente do plano não é entregue.
export function TelaPendente({ slug }: { slug: string }) {
  const tela = telaPorSlug(slug)
  const Icone = tela.icone

  return (
    <>
      <section className="mb-7">
        <SecaoCabecalho
          titulo="Escopo desta tela"
          apoio={`entregue na etapa ${tela.etapa} do plano de execução`}
        />
        <ul className="grid max-w-[78ch] gap-1.5 text-xs leading-relaxed text-muted-foreground">
          {tela.secoes.map((secao) => (
            <li key={secao} className="flex gap-2">
              <span
                aria-hidden
                className="mt-[7px] size-[5px] shrink-0 rounded-full bg-primary"
              />
              {secao}
            </li>
          ))}
        </ul>
      </section>
      <Vazio icone={<Icone />} titulo={`${tela.titulo} em construção`}>
        O shell, os tokens e a navegação já seguem o protótipo. O conteúdo desta
        tela chega na etapa {tela.etapa}, descrita em docs/PLANO-DE-EXECUCAO.md.
      </Vazio>
    </>
  )
}
