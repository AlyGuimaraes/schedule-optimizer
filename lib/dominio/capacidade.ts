import { demandaPorCargo } from "./demanda"
import { PREM_PADRAO } from "./padroes"
import { premDe } from "./premissas"
import type { Config, LinhaCapacidade, Mundo } from "./tipos"

/**
 * Quadro de pessoal (§7.7): por cargo, o que a demanda teórica pede contra o que o time entrega.
 * Cinco faixas de situação e recomendação escrita em número de pessoas, não em percentual.
 */
export function analiseCapacidade(
  mundo: Mundo,
  cfg?: Partial<Config>,
  nSemanas = 4
): LinhaCapacidade[] {
  const dem = demandaPorCargo(mundo, cfg, nSemanas)
  const papeis = [...new Set(Object.keys(cfg?.papeis ?? PREM_PADRAO).concat(Object.keys(dem)))]
  return papeis
    .map((pp) => {
      const c = premDe(cfg, pp)
      const pessoas = mundo.pessoas.filter((p) => p.papel === pp).length
      const d = dem[pp] ?? { horasSemana: 0, cerimoniasSemana: 0, horasSemQuorum: 0 }
      const capacidade = c.teto * pessoas
      const saldoH = capacidade - d.horasSemana
      const fteNecessario = c.teto > 0 ? d.horasSemana / c.teto : 0
      const saldoFte = c.teto > 0 ? saldoH / c.teto : 0
      const ocupacao =
        capacidade > 0 ? (d.horasSemana / capacidade) * 100 : d.horasSemana > 0 ? Infinity : 0
      let situacao: LinhaCapacidade["situacao"] = "equilibrado"
      let acao = "manter o time como está"
      if (!pessoas && d.horasSemana > 0) {
        situacao = "sem ninguém"
        acao = `contratar ${Math.ceil(fteNecessario)} para o cargo`
      } else if (saldoFte <= -0.25) {
        situacao = "falta gente"
        acao = `contratar ${Math.ceil(-saldoFte)} pessoa(s)`
      } else if (ocupacao > 88) {
        situacao = "no limite"
        acao = "sem folga para novos projetos"
      } else if (ocupacao < 45 && pessoas > 0) {
        situacao = "folga"
        acao = `cabe ${Math.floor(saldoFte)} projeto-pessoa a mais`
      }
      return {
        papel: pp,
        pessoas,
        teto: c.teto,
        demanda: d.horasSemana,
        cerimonias: d.cerimoniasSemana,
        semQuorum: d.horasSemQuorum,
        capacidade,
        saldoH,
        fteNecessario,
        saldoFte,
        ocupacao,
        situacao,
        acao,
      }
    })
    .sort((a, b) => a.saldoFte - b.saldoFte)
}
