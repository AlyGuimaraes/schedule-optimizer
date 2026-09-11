from __future__ import annotations

import json
from pathlib import Path

import pytest
from fabrica import GERAL, cerimonia, pessoa, requisicao
from verificador import violacoes

from cadencia_solver.contrato import Dica, Opcoes, RequisicaoSemana
from cadencia_solver.modelo import (
    MOTIVO_MENSAL,
    MOTIVO_OPCIONAL,
    MOTIVO_SEM_JANELA,
    resolver_semana,
)

SEMENTE = Path(__file__).parent / "dados" / "semana-1.json"


def resolver(req: RequisicaoSemana):
    resp = resolver_semana(req)
    assert resp.status in ("otimo", "viavel")
    assert violacoes(req, resp) == []
    return resp


def por_id(resp):
    return {a.cerimonia_id: a for a in resp.alocadas}


def test_mesma_pessoa_sem_sobreposicao_e_com_intervalo():
    req = requisicao([pessoa(0)], [cerimonia(i, [0], dur=60) for i in range(3)])
    resp = resolver(req)
    assert len(resp.alocadas) == 3
    assert resp.nao_alocadas == []
    assert all(a.camada == 1 for a in resp.alocadas)


def test_janela_protegida_e_almoco():
    req = requisicao(
        [pessoa(0, foco_prot=6, foco_prot_relaxado=6), pessoa(1)],
        [cerimonia(i, [0, 1], papeis=["Arquiteto", "Gerente"]) for i in range(2)],
    )
    resp = resolver(req)
    assert len(resp.alocadas) == 2
    # a janela do arquiteto vale para a reunião inteira (§4.2)
    assert all(a.slot >= 6 for a in resp.alocadas)


def test_dia_protegido():
    req = requisicao(
        [pessoa(0, max_reunioes_dia=1, max_reunioes_dia_relaxado=1)],
        [cerimonia(i, [0], dur=30) for i in range(4)],
        geral=GERAL.model_copy(update={"dia_protegido": "sexta"}),
    )
    resp = resolver(req)
    assert len(resp.alocadas) == 4
    assert all(a.dia != 4 for a in resp.alocadas)


def test_limite_diario_espalha_na_semana():
    req = requisicao(
        [pessoa(0, max_reunioes_dia=1, max_reunioes_dia_relaxado=1)],
        [cerimonia(i, [0], dur=30) for i in range(3)],
    )
    resp = resolver(req)
    assert len({a.dia for a in resp.alocadas}) == 3


def test_teto_semanal_relaxa_obrigatoria_com_concessao():
    req = requisicao(
        [pessoa(0, teto=1.0, teto_relaxado=2.0)],
        [cerimonia(0, [0], dur=60), cerimonia(1, [0], dur=60)],
    )
    resp = resolver(req)
    assert len(resp.alocadas) == 2
    relaxadas = [a for a in resp.alocadas if a.relaxada]
    assert len(relaxadas) == 1 and relaxadas[0].camada == 3
    teto = [c for c in resp.concessoes if c.premissa == "teto de reunião"]
    assert len(teto) == 1
    assert teto[0].alvo == 1.0 and teto[0].valor == 2.0 and teto[0].un == "h"


def test_opcional_nunca_aciona_a_camada_3():
    req = requisicao(
        [pessoa(0, teto=1.0, teto_relaxado=2.0)],
        [cerimonia(0, [0], dur=60), cerimonia(1, [0], dur=60, obrigatoria=False, prio=5)],
    )
    resp = resolver(req)
    assert [a.cerimonia_id for a in resp.alocadas] == [0]
    assert resp.nao_alocadas[0].motivo == MOTIVO_OPCIONAL
    assert resp.concessoes == []


def test_orcamento_mensal_acumulado():
    req = requisicao(
        [pessoa(0, acumulado=29.5, orcamento_mensal=30.0)],
        [cerimonia(0, [0], dur=60)],
    )
    resp = resolver(req)
    assert resp.alocadas == []
    assert resp.nao_alocadas[0].motivo == MOTIVO_MENSAL


def test_troca_de_cadeira_antes_de_relaxar():
    req = requisicao(
        [pessoa(0, teto=0.5, teto_relaxado=2.0), pessoa(1)],
        [cerimonia(0, [0], dur=60, candidatos=[[1]])],
    )
    resp = resolver(req)
    a = resp.alocadas[0]
    assert a.camada == 2 and not a.relaxada
    assert a.participantes == [1]
    assert [(t.de, t.para) for t in a.trocas] == [(0, 1)]
    assert resp.concessoes == []


def test_sem_troca_quando_desligada():
    req = requisicao(
        [pessoa(0, teto=0.5, teto_relaxado=2.0), pessoa(1)],
        [cerimonia(0, [0], dur=60, candidatos=[[1]])],
        permitir_troca=False,
    )
    resp = resolver(req)
    assert resp.alocadas[0].camada == 3
    assert resp.alocadas[0].participantes == [0]


def test_ancora_e_estabilidade():
    req = requisicao(
        [pessoa(0), pessoa(1)],
        [cerimonia(0, [0], ancora=(2, 12)), cerimonia(1, [1], vigente=(3, 14))],
    )
    resp = resolver(req)
    alocadas = por_id(resp)
    assert (alocadas[0].dia, alocadas[0].slot) == (2, 12) and alocadas[0].ancorada
    assert (alocadas[1].dia, alocadas[1].slot) == (3, 14)


def test_cerimonia_sem_inicio_viavel():
    # 2h30 não cabe na duração máxima nem relaxada
    req = requisicao([pessoa(0, duracao_max=4, duracao_max_relaxada=4)], [cerimonia(0, [0], dur=150)])
    resp = resolver(req)
    assert resp.alocadas == []
    assert resp.nao_alocadas[0].motivo == MOTIVO_SEM_JANELA


def test_dica_e_avaliada_no_mesmo_modelo():
    pessoas = [pessoa(i) for i in range(3)]
    cerimonias = [cerimonia(i, [i % 3, (i + 1) % 3]) for i in range(6)]
    # com 4 workers o CP-SAT não prova o ótimo desta instância em 10 s; com 8, em 2 a 4 s
    opcoes = Opcoes(limite_segundos=3, workers=8)
    primeira = resolver(requisicao(pessoas, cerimonias, opcoes=opcoes))
    dica = [
        Dica(cerimonia_id=a.cerimonia_id, dia=a.dia, slot=a.slot, relaxada=a.relaxada, participantes=a.participantes)
        for a in primeira.alocadas
    ]
    resp = resolver(requisicao(pessoas, cerimonias, dica=dica, opcoes=opcoes))
    assert resp.objetivo_dica is not None
    assert resp.objetivo <= resp.objetivo_dica + 1e-6


def test_dica_fora_do_modelo_nao_quebra():
    req = requisicao([pessoa(0, foco_prot=6, foco_prot_relaxado=6)], [cerimonia(0, [0])])
    req = req.model_copy(update={"dica": [Dica(cerimonia_id=0, dia=0, slot=0, relaxada=False, participantes=[0])]})
    resp = resolver(req)
    assert resp.objetivo_dica is None
    assert len(resp.alocadas) == 1


@pytest.mark.skipif(not SEMENTE.exists(), reason="rode `pnpm solver:comparar -- --exportar` para gerar")
def test_semana_1_da_semente():
    dados = json.loads(SEMENTE.read_text())
    req = RequisicaoSemana.model_validate(dados)
    req = req.model_copy(update={"opcoes": Opcoes(limite_segundos=20, workers=8)})
    resp = resolver(req)
    obrigatorias = {c.id for c in req.cerimonias if c.obrigatoria}
    alocadas = {a.cerimonia_id for a in resp.alocadas}
    # a dica gulosa entra no modelo e o CP-SAT não fica pior que ela
    assert resp.objetivo_dica is not None
    assert resp.objetivo <= resp.objetivo_dica + 1e-6
    assert len(alocadas & obrigatorias) >= len(obrigatorias) - 1
