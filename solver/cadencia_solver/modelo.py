"""
Modelo CP-SAT de uma semana (§4.1 da especificação).

Variáveis de decisão
  x[c,d,s]        a cerimônia c começa no dia d, slot s. Só existem inícios pré-filtrados por
                  jornada, almoço, dia protegido, duração máxima e janela protegida (R4, R6, R7, R13)
  p[c,i,q,d,s]    a cadeira i de c é ocupada por q quando c começa em (d,s): troca de cadeira (camada 2)
  rel[c]          c entra com relaxamento controlado (camada 3), só cerimônia obrigatória
  nao[c]          escape da obrigatória não alocada (R2 vira objetivo, com peso alto)

Restrições rígidas: as mesmas do validador independente (lib/dominio/validador.ts). Sem sobreposição
com intervalos opcionais por pessoa estendidos pelo intervalo obrigatório (R3, R5); limites diários
(R8, R9); teto semanal com folga até o limite aceitável do perfil (R10); orçamento mensal pró-rata
acumulado (R11); quórum de 100% (R12).

Objetivo: soma ponderada dos termos w1 a w8 do §4.1, com a ordem das camadas imposta pelos pesos:
dentro do alvo custa zero, troca de cadeira custa pouco, relaxamento custa muito e não alocar uma
obrigatória custa mais que qualquer concessão.
"""

from __future__ import annotations

import math
import time
from collections import defaultdict
from dataclasses import dataclass

from ortools.sat.python import cp_model

from .contrato import (
    VERSAO_CONTRATO,
    Alocacao,
    Cerimonia,
    Concessao,
    Dica,
    Estatisticas,
    Geral,
    NaoAlocada,
    Opcoes,
    RequisicaoSemana,
    RespostaSemana,
    Troca,
)

# Pesos em unidades inteiras. Os termos que vêm do guloso (fragmentação, preferência, contexto,
# prazo) usam a mesma escala dele multiplicada por ESCALA, então 1,5 vira 150.
ESCALA = 100
PESO_NAO_OBRIGATORIA = 100_000
PESO_NAO_SLA = 50_000
PESO_PRIO_OBRIGATORIA = 10_000
PESO_SCORE_OBRIGATORIA = 1_000
PESO_NAO_OPCIONAL = 15_000
PESO_PRIO_OPCIONAL = 1_000
PESO_SCORE_OPCIONAL = 200
PESO_RELAXADA = 30_000
PESO_FOLGA_MINUTO = 100
PESO_TROCA = 8_000
PESO_FORA_ANCORA = 20_000
PESO_DIA_ATIVO = 120
PESO_PROJETO_DIA = 30
PESO_PERFIL_ANCORAR = 220
PESO_DESBALANCEAMENTO = 1

# Folga de arredondamento em minutos. O validador aceita até 1e-9 h (6e-8 min) acima do limite.
EPS_MINUTOS = 1e-8

STATUS = {
    cp_model.OPTIMAL: "otimo",
    cp_model.FEASIBLE: "viavel",
    cp_model.INFEASIBLE: "inviavel",
    cp_model.MODEL_INVALID: "invalido",
    cp_model.UNKNOWN: "sem_solucao",
}

MOTIVO_SEM_JANELA = "sem janela viável nem com tolerância"
MOTIVO_OPCIONAL = "opcional · sem folga no alvo"
MOTIVO_MENSAL = "excede o teto mensal do cargo"
MOTIVO_SEMANAL = "excede o limite semanal aceitável"


def minutos(horas: float) -> int:
    """Limite em horas convertido para minutos inteiros, arredondado para baixo."""
    return math.floor(horas * 60 + EPS_MINUTOS)


def almoco(g: Geral, t: int) -> bool:
    return g.almoco_inicio <= t < g.almoco_inicio + g.almoco_dur


def dia_bloqueado(g: Geral, d: int, s: int, duracao: int, dias: int) -> bool:
    """Mesma regra de `diaBloqueado` em lib/dominio/disponibilidade.ts (R13)."""
    if g.dia_protegido == "sexta" and d == dias - 1:
        return True
    if g.dia_protegido == "sexta-tarde" and d == dias - 1 and s + duracao > g.almoco_inicio + g.almoco_dur:
        return True
    return False


def peso_nao_alocada(c: Cerimonia) -> int:
    if c.obrigatoria:
        return (
            PESO_NAO_OBRIGATORIA
            + (PESO_NAO_SLA if c.sla else 0)
            + PESO_PRIO_OBRIGATORIA * max(0, 5 - c.prio)
            + round(PESO_SCORE_OBRIGATORIA * c.score)
        )
    return PESO_NAO_OPCIONAL + PESO_PRIO_OPCIONAL * max(0, 5 - c.prio) + round(PESO_SCORE_OPCIONAL * c.score)


@dataclass
class Presenca:
    """Uma possibilidade de a pessoa estar na cerimônia c começando em (dia, slot)."""

    cerimonia: Cerimonia
    dia: int
    slot: int
    literal: cp_model.IntVar
    titular: bool


class ModeloSemana:
    def __init__(self, req: RequisicaoSemana):
        self.req = req
        self.g = req.geral
        self.dias = req.grade.dias
        self.slots_dia = req.grade.slots_dia
        self.pessoas = {p.id: p for p in req.pessoas}
        self.cerimonias = {c.id: c for c in req.cerimonias}
        self.pref = set(self.g.preferidos)
        # dias separados na linha do tempo dos intervalos, para o intervalo obrigatório não vazar de um dia para o outro
        self.passo_dia = self.slots_dia + self.g.buffer + 1

        self.m = cp_model.CpModel()
        self.x: dict[int, dict[tuple[int, int], cp_model.IntVar]] = {}
        self.cadeiras: dict[tuple[int, int, int, int], list[tuple[int, cp_model.IntVar]]] = {}
        self.rel: dict[int, cp_model.IntVar] = {}
        self.nao: dict[int, cp_model.IntVar] = {}
        self.sem_inicio: set[int] = set()
        self.presencas: dict[int, list[Presenca]] = defaultdict(list)
        self.minutos_semana: dict[int, cp_model.LinearExpr] = {}
        self._rel_dia: dict[tuple[int, int], cp_model.IntVar] = {}

        self._vars: list[cp_model.IntVar] = []
        self._coefs: list[int] = []
        self._constante = 0

        self._construir()

    # ───────────────────────── construção ─────────────────────────

    def _custo(self, var, coef: int) -> None:
        if coef:
            self._vars.append(var)
            self._coefs.append(int(coef))

    def _construir(self) -> None:
        for c in self.req.cerimonias:
            self._cerimonia(c)
        for pid in sorted(self.presencas):
            self._pessoa(pid, self.presencas[pid])
        self._desbalanceamento()
        self.m.Minimize(cp_model.LinearExpr.WeightedSum(self._vars, self._coefs) + self._constante)

    def _base_ok(self, d: int, s: int, duracao: int) -> bool:
        """Jornada, almoço e dia protegido (R4, R13): valem para todos os participantes."""
        g = self.g
        if s < g.inicio or s + duracao > g.fim or s + duracao > self.slots_dia:
            return False
        if any(almoco(g, s + i) for i in range(duracao)):
            return False
        return not dia_bloqueado(g, d, s, duracao, self.dias)

    def _pessoa_ok(self, pid: int, s: int, duracao: int, relaxada: bool) -> bool:
        """Janela protegida e duração máxima da pessoa (R6, R7), no alvo ou relaxadas."""
        pr = self.pessoas[pid].premissas
        janela = pr.foco_prot_relaxado if relaxada else pr.foco_prot
        dur_max = pr.duracao_max_relaxada if relaxada else pr.duracao_max
        return s >= janela and duracao <= dur_max

    def _cerimonia(self, c: Cerimonia) -> None:
        m = self.m
        dur = c.slots
        titulares = [cad.titular for cad in c.cadeiras]
        pode_relaxar = self.req.permitir_relaxar and c.obrigatoria
        opcoes: list[list[int]] = []
        for cad in c.cadeiras:
            alternativas = (
                [q for q in dict.fromkeys(cad.candidatos) if q in self.pessoas and q not in titulares]
                if self.req.permitir_troca
                else []
            )
            opcoes.append([cad.titular, *alternativas])

        rel = m.NewBoolVar(f"rel_{c.id}") if pode_relaxar else None
        if rel is not None:
            self.rel[c.id] = rel

        inicios: dict[tuple[int, int], cp_model.IntVar] = {}
        for d in range(self.dias):
            for s in range(self.g.inicio, self.g.fim - dur + 1):
                if not self._base_ok(d, s, dur):
                    continue
                normal = all(any(self._pessoa_ok(q, s, dur, False) for q in ops) for ops in opcoes)
                relaxa = pode_relaxar and all(self._pessoa_ok(t, s, dur, True) for t in titulares)
                if not (normal or relaxa):
                    continue
                x = m.NewBoolVar(f"x_{c.id}_{d}_{s}")
                inicios[(d, s)] = x
                if not normal:
                    m.AddImplication(x, rel)
                elif rel is not None and not relaxa:
                    m.AddBoolOr([x.Not(), rel.Not()])

                for i, ops in enumerate(opcoes):
                    titular = ops[0]
                    if len(ops) == 1:
                        self.presencas[titular].append(Presenca(c, d, s, x, True))
                        continue
                    literais: list[tuple[int, cp_model.IntVar]] = []
                    for q in ops:
                        ok_alvo = self._pessoa_ok(q, s, dur, False)
                        ok_relaxada = q == titular and relaxa
                        if not (ok_alvo or ok_relaxada):
                            continue
                        lit = m.NewBoolVar(f"p_{c.id}_{i}_{q}_{d}_{s}")
                        literais.append((q, lit))
                        if q == titular:
                            if not ok_alvo:
                                m.AddImplication(lit, rel)
                        else:
                            # troca de cadeira é camada 2: nunca junto com relaxamento
                            if rel is not None:
                                m.AddBoolOr([lit.Not(), rel.Not()])
                            self._custo(lit, PESO_TROCA)
                        self.presencas[q].append(Presenca(c, d, s, lit, q == titular))
                    m.Add(sum(lit for _, lit in literais) == x)
                    self.cadeiras[(c.id, i, d, s)] = literais

                self._custos_do_inicio(c, d, s, x)

        self.x[c.id] = inicios
        peso = peso_nao_alocada(c)
        if not inicios:
            self.sem_inicio.add(c.id)
            if rel is not None:
                m.Add(rel == 0)
            self._constante += peso
            return

        alocada = sum(inicios.values())
        if c.obrigatoria:
            nao = m.NewBoolVar(f"nao_{c.id}")
            m.Add(alocada + nao == 1)
            self.nao[c.id] = nao
            self._custo(nao, peso)
        else:
            m.Add(alocada <= 1)
            self._constante += peso
            for x in inicios.values():
                self._custo(x, -peso)
        if rel is not None:
            m.Add(rel <= alocada)
            self._custo(rel, PESO_RELAXADA)

        if c.ancora is not None and (c.ancora.dia, c.ancora.slot) in inicios:
            alvo = (c.ancora.dia, c.ancora.slot)
            for pos, x in inicios.items():
                if pos != alvo:
                    self._custo(x, PESO_FORA_ANCORA)

    def _custos_do_inicio(self, c: Cerimonia, d: int, s: int, x) -> None:
        """Termos que só dependem do início: w6 estabilidade, w7 preferência, w8 prazo e o perfil ancorado."""
        g = self.g
        fora = sum(1 for t in range(s, s + c.slots) if t not in self.pref)
        custo = len(c.cadeiras) * fora * round(g.peso_preferencia * ESCALA)
        # como o guloso: cerimônia com prazo curto é puxada para o começo da semana e do dia
        custo += d * (240 if c.sla else 2) + s * (6 if c.sla else 1)
        if self.req.perfil.ancorar and d != c.projeto_id % self.dias:
            custo += PESO_PERFIL_ANCORAR
        if c.vigente is not None and (c.vigente.dia, c.vigente.slot) != (d, s):
            custo += round(self.req.peso_estabilidade * ESCALA)
        self._custo(x, custo)

    def _rel_no_dia(self, cid: int, d: int):
        """Literal verdadeiro só se a cerimônia cid está relaxada e caiu no dia d."""
        chave = (cid, d)
        if chave not in self._rel_dia:
            no_dia = [x for (dia, _), x in self.x[cid].items() if dia == d]
            z = self.m.NewBoolVar(f"reldia_{cid}_{d}")
            self.m.AddImplication(z, self.rel[cid])
            self.m.Add(z <= sum(no_dia))
            self._rel_dia[chave] = z
        return self._rel_dia[chave]

    def _pessoa(self, pid: int, lista: list[Presenca]) -> None:
        m = self.m
        g = self.g
        p = self.pessoas[pid]
        pr = p.premissas

        # R3 e R5: sem sobreposição, com o intervalo obrigatório somado ao fim de cada cerimônia
        intervalos = [
            m.NewOptionalFixedSizeIntervalVar(
                e.dia * self.passo_dia + e.slot,
                e.cerimonia.slots + g.buffer,
                e.literal,
                f"i_{pid}_{e.cerimonia.id}_{e.dia}_{e.slot}",
            )
            for e in lista
        ]
        m.AddNoOverlap(intervalos)

        # R10: teto semanal, com folga até o limite aceitável só para quem está numa cerimônia relaxada
        semana = sum(e.cerimonia.dur * e.literal for e in lista)
        self.minutos_semana[pid] = semana
        teto = minutos(pr.teto)
        teto_relaxado = max(teto, minutos(pr.teto_relaxado))
        relaxaveis = sorted({e.cerimonia.id for e in lista if e.titular and e.cerimonia.id in self.rel})
        if teto_relaxado > teto and relaxaveis:
            folga = m.NewIntVar(0, teto_relaxado - teto, f"folga_{pid}")
            m.Add(folga <= (teto_relaxado - teto) * sum(self.rel[cid] for cid in relaxaveis))
            m.Add(semana <= teto + folga)
            self._custo(folga, PESO_FOLGA_MINUTO)
        else:
            m.Add(semana <= teto)

        # R11: orçamento mensal pró-rata descontado o acumulado das semanas anteriores
        m.Add(semana <= max(0, minutos(pr.orcamento_mensal - p.acumulado)))

        # R8 e R9: limites diários, afrouxados pelo perfil só no dia com cerimônia relaxada
        extra_reunioes = max(0, pr.max_reunioes_dia_relaxado - pr.max_reunioes_dia)
        horas_dia = minutos(pr.max_horas_dia)
        extra_horas = max(0, minutos(pr.max_horas_dia_relaxado) - horas_dia)
        por_dia: dict[int, list[Presenca]] = defaultdict(list)
        for e in lista:
            por_dia[e.dia].append(e)
        for d in sorted(por_dia):
            es = por_dia[d]
            reunioes = sum(e.literal for e in es)
            mins = sum(e.cerimonia.dur * e.literal for e in es)
            relaxaveis_dia = sorted({e.cerimonia.id for e in es if e.titular and e.cerimonia.id in self.rel})
            if relaxaveis_dia and (extra_reunioes or extra_horas):
                relaxado = m.NewBoolVar(f"diarelax_{pid}_{d}")
                m.Add(relaxado <= sum(self._rel_no_dia(cid, d) for cid in relaxaveis_dia))
                m.Add(reunioes <= pr.max_reunioes_dia + extra_reunioes * relaxado)
                m.Add(mins <= horas_dia + extra_horas * relaxado)
            else:
                m.Add(reunioes <= pr.max_reunioes_dia)
                m.Add(mins <= horas_dia)
            self._fragmentacao(pid, d, es)
            self._contexto(pid, d, es)

    def _fragmentacao(self, pid: int, d: int, es: list[Presenca]) -> None:
        """
        w1: a mesma penalidade de `custoDia` do guloso, linearizada. Por segmento livre de almoço:
        tempo livre que não forma bloco de foco + meio ponto por bloco livre.
        """
        m = self.m
        g = self.g
        peso = round(self.req.perfil.peso_frag * ESCALA)
        if peso <= 0:
            return
        ocupa: dict[int, list] = defaultdict(list)
        for e in es:
            for t in range(e.slot, e.slot + e.cerimonia.slots):
                ocupa[t].append(e.literal)

        segmentos: list[list[int]] = []
        atual: list[int] = []
        for t in range(g.inicio, g.fim):
            if almoco(g, t):
                if atual:
                    segmentos.append(atual)
                atual = []
            else:
                atual.append(t)
        if atual:
            segmentos.append(atual)

        bloco = max(1, self.pessoas[pid].premissas.bloco_foco_min)
        meio = round(peso / 2)
        for seg in segmentos:
            if not any(ocupa[t] for t in seg):
                continue  # segmento que nunca recebe cerimônia: custo constante
            janelas: list[tuple[set[int], cp_model.IntVar]] = []
            for k in range(len(seg) - bloco + 1):
                janela = seg[k : k + bloco]
                f = m.NewBoolVar(f"janela_{pid}_{d}_{janela[0]}")
                for t in janela:
                    if ocupa[t]:
                        m.Add(f + sum(ocupa[t]) <= 1)
                janelas.append((set(janela), f))
            for idx, t in enumerate(seg):
                ocupado = sum(ocupa[t]) if ocupa[t] else 0
                # livre e fora de bloco de foco custa `peso`; livre = 1 − ocupado
                for lit in ocupa[t]:
                    self._custo(lit, -peso)
                cobrem = [f for jan, f in janelas if t in jan]
                if cobrem:
                    foco = m.NewBoolVar(f"foco_{pid}_{d}_{t}")
                    m.Add(foco <= sum(cobrem))
                    self._custo(foco, -peso)
                # início de bloco livre: meio ponto
                inicio = m.NewBoolVar(f"bloco_{pid}_{d}_{t}")
                if idx == 0:
                    m.Add(inicio >= 1 - ocupado)
                else:
                    anterior = seg[idx - 1]
                    anterior_ocupado = sum(ocupa[anterior]) if ocupa[anterior] else 0
                    m.Add(inicio >= anterior_ocupado - ocupado)
                self._custo(inicio, meio)

    def _contexto(self, pid: int, d: int, es: list[Presenca]) -> None:
        """w4: abrir mais um dia com reunião e alternar entre projetos no mesmo dia."""
        m = self.m
        ativo = m.NewBoolVar(f"ativo_{pid}_{d}")
        por_projeto: dict[int, list] = defaultdict(list)
        for e in es:
            m.AddImplication(e.literal, ativo)
            por_projeto[e.cerimonia.projeto_id].append(e.literal)
        self._custo(ativo, PESO_DIA_ATIVO)
        for proj in sorted(por_projeto):
            pj = m.NewBoolVar(f"proj_{pid}_{d}_{proj}")
            for lit in por_projeto[proj]:
                m.AddImplication(lit, pj)
            self._custo(pj, PESO_PROJETO_DIA)

    def _desbalanceamento(self) -> None:
        """w5: diferença de ocupação do teto (em milésimos) entre pessoas do mesmo cargo."""
        m = self.m
        por_papel: dict[str, list[int]] = defaultdict(list)
        for pid in sorted(self.minutos_semana):
            if minutos(self.pessoas[pid].premissas.teto) > 0:
                por_papel[self.pessoas[pid].papel].append(pid)
        for papel, ids in sorted(por_papel.items()):
            if len(ids) < 2:
                continue
            zmax = m.NewIntVar(0, 100_000, f"zmax_{papel}")
            zmin = m.NewIntVar(0, 100_000, f"zmin_{papel}")
            for pid in ids:
                teto = minutos(self.pessoas[pid].premissas.teto)
                semana = self.minutos_semana[pid]
                acima = m.NewIntVar(0, 100_000, f"razao_sup_{pid}")
                abaixo = m.NewIntVar(0, 100_000, f"razao_inf_{pid}")
                m.Add(teto * acima >= 1000 * semana)
                m.Add(teto * abaixo <= 1000 * semana)
                m.Add(zmax >= acima)
                m.Add(zmin <= abaixo)
            self._custo(zmax, PESO_DESBALANCEAMENTO)
            self._custo(zmin, -PESO_DESBALANCEAMENTO)

    # ───────────────────────── dica gulosa ─────────────────────────

    def aplicar_dica(self, dica: list[Dica], fixar: bool = False) -> bool:
        """
        Warm start (`AddHint`) com a solução gulosa. Com `fixar`, a dica vira restrição, para medir
        o objetivo do guloso no mesmo modelo. Devolve False quando a dica cai fora do modelo.
        """
        m = self.m
        por_id = {h.cerimonia_id: h for h in dica}
        coerente = True

        def marcar(var, valor: int) -> None:
            if fixar:
                m.Add(var == valor)
            else:
                m.AddHint(var, valor)

        for c in self.req.cerimonias:
            h = por_id.get(c.id)
            inicios = self.x.get(c.id, {})
            alvo = (h.dia, h.slot) if h is not None else None
            if alvo is not None and alvo not in inicios:
                coerente = False
                alvo = None
            for pos, x in inicios.items():
                marcar(x, int(pos == alvo))
            if c.id in self.nao:
                marcar(self.nao[c.id], 0 if alvo is not None else 1)
            if c.id in self.rel:
                marcar(self.rel[c.id], int(alvo is not None and h is not None and h.relaxada))
            elif alvo is not None and h is not None and h.relaxada:
                coerente = False
            if alvo is None or h is None:
                continue
            for i, cad in enumerate(c.cadeiras):
                literais = self.cadeiras.get((c.id, i, *alvo))
                quem = h.participantes[i] if i < len(h.participantes) else cad.titular
                if not literais:
                    if quem != cad.titular:
                        coerente = False
                    continue
                if quem not in [q for q, _ in literais]:
                    coerente = False
                for q, lit in literais:
                    marcar(lit, int(q == quem))
        return coerente


# ───────────────────────── resolução ─────────────────────────


def _solver(opcoes: Opcoes, limite: float | None = None) -> cp_model.CpSolver:
    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = float(limite if limite is not None else opcoes.limite_segundos)
    solver.parameters.num_workers = opcoes.workers
    solver.parameters.random_seed = opcoes.semente
    return solver


def avaliar_dica(req: RequisicaoSemana, opcoes: Opcoes) -> float | None:
    """Objetivo da solução gulosa no mesmo modelo (a dica fixada). None se a dica não cabe no modelo."""
    if not req.dica:
        return None
    modelo = ModeloSemana(req)
    if not modelo.aplicar_dica(req.dica, fixar=True):
        return None
    solver = _solver(opcoes, limite=min(opcoes.limite_segundos, 20.0))
    status = solver.Solve(modelo.m)
    if status not in (cp_model.OPTIMAL, cp_model.FEASIBLE):
        return None
    return solver.ObjectiveValue()


def _motivo(
    c: Cerimonia, modelo: ModeloSemana, minutos_pessoa: dict[int, int]
) -> str:
    """Motivo de não alocação no vocabulário do guloso."""
    if c.id in modelo.sem_inicio:
        return MOTIVO_SEM_JANELA
    if not c.obrigatoria:
        return MOTIVO_OPCIONAL
    titulares = [cad.titular for cad in c.cadeiras]
    for t in titulares:
        p = modelo.pessoas[t]
        if minutos_pessoa[t] + c.dur > minutos(p.premissas.orcamento_mensal - p.acumulado):
            return MOTIVO_MENSAL
    for t in titulares:
        if minutos_pessoa[t] + c.dur > minutos(modelo.pessoas[t].premissas.teto_relaxado):
            return MOTIVO_SEMANAL
    return MOTIVO_SEM_JANELA


def concessoes_do_plano(req: RequisicaoSemana, alocadas: list[Alocacao]) -> list[Concessao]:
    """
    Registro auditável das concessões, com a mesma regra de `registrar` no guloso: as relaxadas
    entram depois de todas as outras, em ordem de prioridade, e cada participante registra o que
    a cerimônia fez passar do alvo naquele momento.
    """
    cer = {c.id: c for c in req.cerimonias}
    pessoas = {p.id: p for p in req.pessoas}
    carga: dict[int, float] = defaultdict(float)
    reunioes_dia: dict[tuple[int, int], int] = defaultdict(int)
    horas_dia: dict[tuple[int, int], float] = defaultdict(float)

    def somar(a: Alocacao) -> None:
        h = cer[a.cerimonia_id].dur / 60
        for p in a.participantes:
            carga[p] += h
            reunioes_dia[(p, a.dia)] += 1
            horas_dia[(p, a.dia)] += h

    for a in alocadas:
        if not a.relaxada:
            somar(a)

    saida: list[Concessao] = []
    relaxadas = sorted(
        (a for a in alocadas if a.relaxada),
        key=lambda a: (cer[a.cerimonia_id].prio, a.dia, a.slot, a.cerimonia_id),
    )
    for a in relaxadas:
        c = cer[a.cerimonia_id]
        h = c.dur / 60
        for p in a.participantes:
            pr = pessoas[p].premissas

            def registrar(premissa: str, alvo: float, valor: float, un: str) -> None:
                saida.append(
                    Concessao(cerimonia_id=c.id, pessoa_id=p, premissa=premissa, alvo=alvo, valor=valor, un=un)
                )

            if carga[p] + h > pr.teto + 1e-9:
                registrar("teto de reunião", pr.teto, carga[p] + h, "h")
            if reunioes_dia[(p, a.dia)] + 1 > pr.max_reunioes_dia:
                registrar("máx. reuniões/dia", pr.max_reunioes_dia, reunioes_dia[(p, a.dia)] + 1, "")
            if horas_dia[(p, a.dia)] + h > pr.max_horas_dia + 1e-9:
                registrar("máx. horas/dia", pr.max_horas_dia, horas_dia[(p, a.dia)] + h, "h")
            if a.slot < pr.foco_prot:
                registrar("janela protegida", pr.foco_prot / 2, a.slot / 2, "h")
            if c.slots > pr.duracao_max:
                registrar("duração máx. da reunião", pr.duracao_max / 2, c.slots / 2, "h")
        somar(a)
    return saida


def resolver_semana(req: RequisicaoSemana) -> RespostaSemana:
    t0 = time.perf_counter()
    opcoes = req.opcoes or Opcoes()
    modelo = ModeloSemana(req)
    if req.dica:
        modelo.aplicar_dica(req.dica)

    solver = _solver(opcoes)
    codigo = solver.Solve(modelo.m)
    status = STATUS.get(codigo, "sem_solucao")
    tem_solucao = codigo in (cp_model.OPTIMAL, cp_model.FEASIBLE)

    alocadas: list[Alocacao] = []
    nao_alocadas: list[NaoAlocada] = []
    concessoes: list[Concessao] = []
    if tem_solucao:
        minutos_pessoa: dict[int, int] = defaultdict(int)
        for c in req.cerimonias:
            inicio = next((pos for pos, x in modelo.x[c.id].items() if solver.BooleanValue(x)), None)
            if inicio is None:
                continue
            d, s = inicio
            participantes: list[int] = []
            trocas: list[Troca] = []
            for i, cad in enumerate(c.cadeiras):
                literais = modelo.cadeiras.get((c.id, i, d, s))
                quem = (
                    next(q for q, lit in literais if solver.BooleanValue(lit)) if literais else cad.titular
                )
                participantes.append(quem)
                if quem != cad.titular:
                    trocas.append(Troca(de=cad.titular, para=quem, papel=cad.papel))
                minutos_pessoa[quem] += c.dur
            relaxada = c.id in modelo.rel and solver.BooleanValue(modelo.rel[c.id])
            alocadas.append(
                Alocacao(
                    cerimonia_id=c.id,
                    dia=d,
                    slot=s,
                    camada=3 if relaxada else 2 if trocas else 1,
                    participantes=participantes,
                    trocas=trocas,
                    relaxada=relaxada,
                    ancorada=c.ancora is not None and (c.ancora.dia, c.ancora.slot) == (d, s),
                )
            )
        alocadas.sort(key=lambda a: (a.dia, a.slot, a.cerimonia_id))
        alocadas_ids = {a.cerimonia_id for a in alocadas}
        nao_alocadas = [
            NaoAlocada(cerimonia_id=c.id, motivo=_motivo(c, modelo, minutos_pessoa))
            for c in req.cerimonias
            if c.id not in alocadas_ids
        ]
        concessoes = concessoes_do_plano(req, alocadas)

    objetivo_dica = avaliar_dica(req, opcoes) if req.dica and opcoes.avaliar_dica else None
    proto = modelo.m.Proto()
    return RespostaSemana(
        versao=VERSAO_CONTRATO,
        status=status,
        objetivo=solver.ObjectiveValue() if tem_solucao else None,
        limite_inferior=solver.BestObjectiveBound() if tem_solucao else None,
        objetivo_dica=objetivo_dica,
        ms=round((time.perf_counter() - t0) * 1000, 1),
        alocadas=alocadas,
        nao_alocadas=nao_alocadas,
        concessoes=concessoes,
        estatisticas=Estatisticas(
            variaveis=len(proto.variables),
            restricoes=len(proto.constraints),
            workers=opcoes.workers,
            conflitos=solver.NumConflicts(),
            ramos=solver.NumBranches(),
            tempo_solver=round(solver.WallTime(), 3),
        ),
    )
