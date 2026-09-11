import fs from "node:fs"
import path from "node:path"
import vm from "node:vm"

import type { Config, ItemPlaybook, Mundo, Simulacao } from "@/lib/dominio"

const ARQUIVO = path.join(process.cwd(), "docs/referencia/cadencia-leverpro.html")
const INICIO = "// ============ Cadência — motor de simulação ============"
const MARCA_FIM = "CADÊNCIA · CAMADA DE INTERFACE"

export interface MotorPrototipo {
  construirMundo: (seed?: number) => Mundo
  simular: (mundo: Mundo, cfg: Config & { mundo?: Mundo }) => Simulacao
  gerarDemanda: (mundo: Mundo, semana: number, cfg: Config) => { length: number }[]
  PLAYBOOK: Record<string, ItemPlaybook[]>
  criarCfg: (parcial?: Partial<Config>) => Config & { mundo?: Mundo }
}

/**
 * Carrega o motor do protótipo num contexto novo, direto do HTML de referência.
 * Contexto novo por chamada, porque o protótipo mantém PLAYBOOK e FASES globais e mutáveis.
 */
export function carregarMotor(): MotorPrototipo {
  const html = fs.readFileSync(ARQUIVO, "utf8")
  const inicio = html.indexOf(INICIO)
  const marca = html.indexOf(MARCA_FIM)
  if (inicio < 0 || marca < 0) throw new Error("motor do protótipo não encontrado no HTML")
  const fonte = html.slice(inicio, html.lastIndexOf("/*", marca))

  const epilogo = `
    globalThis.__API = {
      construirMundo, simular, gerarDemanda, analiseCapacidade, PLAYBOOK, FASES,
      criarCfg(parcial) {
        return Object.assign({}, CFG_PADRAO, {
          papeis: JSON.parse(JSON.stringify(PREM_PADRAO)),
          geral: JSON.parse(JSON.stringify(GERAL_PADRAO)),
          etapas: JSON.parse(JSON.stringify(ETAPAS_PADRAO)),
          clientes: Object.assign({}, CLIENTES_PADRAO)
        }, parcial || {});
      }
    };`

  const ctx = vm.createContext({ console })
  vm.runInContext(fonte + epilogo, ctx, { filename: "prototipo-motor.js" })
  return (ctx as unknown as { __API: MotorPrototipo }).__API
}
