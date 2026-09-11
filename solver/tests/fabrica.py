"""Montagem de requisições pequenas para os testes."""

from __future__ import annotations

from cadencia_solver.contrato import (
    Cadeira,
    Cerimonia,
    Geral,
    Grade,
    Opcoes,
    Perfil,
    Pessoa,
    Posicao,
    PremissasPessoa,
    RequisicaoSemana,
)

GERAL = Geral(
    inicio=0,
    fim=20,
    almoco_inicio=8,
    almoco_dur=2,
    buffer=1,
    preferidos=[4, 5, 6, 7, 10, 11, 12, 13, 14, 15],
    peso_preferencia=1.5,
    dia_protegido="nenhum",
)


def premissas(**ajuste) -> PremissasPessoa:
    base = dict(
        teto=8.0,
        teto_relaxado=10.0,
        max_reunioes_dia=4,
        max_reunioes_dia_relaxado=5,
        max_horas_dia=3.0,
        max_horas_dia_relaxado=3.5,
        foco_prot=0,
        foco_prot_relaxado=0,
        duracao_max=4,
        duracao_max_relaxada=5,
        bloco_foco_min=4,
        orcamento_mensal=30.0,
    )
    base.update(ajuste)
    return PremissasPessoa(**base)


def pessoa(pid: int, papel: str = "Analista", acumulado: float = 0.0, **ajuste) -> Pessoa:
    return Pessoa(id=pid, nome=f"Pessoa {pid}", papel=papel, acumulado=acumulado, premissas=premissas(**ajuste))


def cerimonia(
    cid: int,
    titulares: list[int],
    dur: int = 60,
    obrigatoria: bool = True,
    prio: int = 2,
    papeis: list[str] | None = None,
    candidatos: list[list[int]] | None = None,
    projeto_id: int | None = None,
    ancora: tuple[int, int] | None = None,
    vigente: tuple[int, int] | None = None,
    sla: bool = False,
) -> Cerimonia:
    papeis = papeis or ["Analista"] * len(titulares)
    candidatos = candidatos or [[] for _ in titulares]
    return Cerimonia(
        id=cid,
        projeto_id=cid if projeto_id is None else projeto_id,
        projeto=f"Projeto {cid}",
        tipo="Reunião de Trabalho",
        dur=dur,
        slots=-(-dur // 30),
        cadeiras=[Cadeira(papel=pp, titular=t, candidatos=cs) for pp, t, cs in zip(papeis, titulares, candidatos)],
        obrigatoria=obrigatoria,
        prio=prio,
        sla=sla,
        score=4.0,
        ancora=Posicao(dia=ancora[0], slot=ancora[1]) if ancora else None,
        vigente=Posicao(dia=vigente[0], slot=vigente[1]) if vigente else None,
    )


def requisicao(pessoas: list[Pessoa], cerimonias: list[Cerimonia], **ajuste) -> RequisicaoSemana:
    base = dict(
        versao="1",
        semana=1,
        grade=Grade(dias=5, slots_dia=20),
        geral=GERAL,
        perfil=Perfil(id="equilibrio", peso_frag=1.0, ancorar=False),
        peso_estabilidade=3.0,
        permitir_troca=True,
        permitir_relaxar=True,
        pessoas=pessoas,
        cerimonias=cerimonias,
        opcoes=Opcoes(limite_segundos=10, workers=4),
    )
    base.update(ajuste)
    return RequisicaoSemana(**base)
