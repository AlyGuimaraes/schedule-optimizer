"""
Conferência das regras rígidas sobre a resposta, escrita de forma independente do modelo.
Espelha lib/dominio/validador.ts, que continua sendo o juiz final do lado do app.
"""

from __future__ import annotations

from collections import defaultdict

from cadencia_solver.contrato import RequisicaoSemana, RespostaSemana
from cadencia_solver.modelo import almoco, dia_bloqueado

TOL = 1e-9


def violacoes(req: RequisicaoSemana, resp: RespostaSemana) -> list[str]:
    g = req.geral
    pessoas = {p.id: p for p in req.pessoas}
    cer = {c.id: c for c in req.cerimonias}
    v: list[str] = []

    vistas: set[int] = set()
    agenda: dict[tuple[int, int], list[tuple[int, int, int]]] = defaultdict(list)
    reunioes: dict[tuple[int, int], int] = defaultdict(int)
    horas_dia: dict[tuple[int, int], float] = defaultdict(float)
    horas: dict[int, float] = defaultdict(float)
    relaxada_dia: set[tuple[int, int]] = set()
    relaxada_semana: set[int] = set()

    for a in resp.alocadas:
        c = cer[a.cerimonia_id]
        if a.cerimonia_id in vistas:
            v.append(f"R1 {c.id} alocada duas vezes")
        vistas.add(a.cerimonia_id)
        if len(a.participantes) != len(c.cadeiras):
            v.append(f"R12 {c.id} sem quórum")
        if a.relaxada and not c.obrigatoria:
            v.append(f"camada 3 em opcional {c.id}")
        if a.relaxada and a.trocas:
            v.append(f"camada 3 com troca {c.id}")
        s, d, dur = a.slot, a.dia, c.slots
        for i, p in enumerate(a.participantes):
            cad = c.cadeiras[i]
            if p != cad.titular and p not in cad.candidatos:
                v.append(f"cadeira {i} de {c.id} com quem não é candidato")
            pr = pessoas[p].premissas
            if s < g.inicio or s + dur > g.fim:
                v.append(f"R4 {c.id} fora da jornada")
            if any(almoco(g, s + k) for k in range(dur)):
                v.append(f"R4 {c.id} no almoço")
            if dia_bloqueado(g, d, s, dur, req.grade.dias):
                v.append(f"R13 {c.id} em dia protegido")
            janela = pr.foco_prot_relaxado if a.relaxada else pr.foco_prot
            if s < max(g.inicio, janela):
                v.append(f"R6 {c.id} invade a janela de {p}")
            dur_max = pr.duracao_max_relaxada if a.relaxada else pr.duracao_max
            if dur > dur_max:
                v.append(f"R7 {c.id} longa demais para {p}")
            agenda[(p, d)].append((s, s + dur, c.id))
            reunioes[(p, d)] += 1
            horas_dia[(p, d)] += c.dur / 60
            horas[p] += c.dur / 60
            if a.relaxada:
                relaxada_dia.add((p, d))
                relaxada_semana.add(p)

    for (p, d), itens in agenda.items():
        itens.sort()
        for (s1, f1, c1), (s2, _, c2) in zip(itens, itens[1:]):
            if s2 < f1:
                v.append(f"R3 {c1} e {c2} sobrepostas para {p}")
            elif s2 < f1 + g.buffer:
                v.append(f"R5 {c1} e {c2} sem intervalo para {p}")
        pr = pessoas[p].premissas
        relax = (p, d) in relaxada_dia
        if reunioes[(p, d)] > (pr.max_reunioes_dia_relaxado if relax else pr.max_reunioes_dia):
            v.append(f"R8 {p} no dia {d}")
        if horas_dia[(p, d)] > (pr.max_horas_dia_relaxado if relax else pr.max_horas_dia) + TOL:
            v.append(f"R9 {p} no dia {d}")

    for p, h in horas.items():
        pr = pessoas[p].premissas
        teto = pr.teto_relaxado if p in relaxada_semana else pr.teto
        if h > teto + TOL:
            v.append(f"R10 {p} com {h} h")
        if pessoas[p].acumulado + h > pr.orcamento_mensal + TOL:
            v.append(f"R11 {p} acima do orçamento mensal")
    return v
