"""
Contrato do solver em Pydantic. Espelha `solver/contrato/semana.schema.json`, que é a fonte única;
o teste `tests/test_contrato.py` confere que os dois não divergem. No TypeScript, o mesmo contrato
vive em `lib/solver/contrato.ts`.

Os campos são snake_case em Python e camelCase no JSON (alias gerado).
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel

VERSAO_CONTRATO = "1"

DiaProtegido = Literal["nenhum", "sexta-tarde", "sexta"]
Status = Literal["otimo", "viavel", "inviavel", "sem_solucao", "invalido"]


class Modelo(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True, extra="forbid")


# ─────────────────────────── requisição ───────────────────────────


class Grade(Modelo):
    dias: int = Field(ge=1)
    slots_dia: int = Field(ge=1)


class Geral(Modelo):
    inicio: int = Field(ge=0)
    fim: int = Field(ge=0)
    almoco_inicio: int = Field(ge=0)
    almoco_dur: int = Field(ge=0)
    buffer: int = Field(ge=0)
    preferidos: list[int]
    peso_preferencia: float = Field(ge=0)
    dia_protegido: DiaProtegido


class Perfil(Modelo):
    id: str
    peso_frag: float = Field(ge=0)
    ancorar: bool


class PremissasPessoa(Modelo):
    teto: float = Field(ge=0)
    teto_relaxado: float = Field(ge=0)
    max_reunioes_dia: int = Field(ge=0)
    max_reunioes_dia_relaxado: int = Field(ge=0)
    max_horas_dia: float = Field(ge=0)
    max_horas_dia_relaxado: float = Field(ge=0)
    foco_prot: int = Field(ge=0)
    foco_prot_relaxado: int = Field(ge=0)
    duracao_max: int = Field(ge=0)
    duracao_max_relaxada: int = Field(ge=0)
    bloco_foco_min: int = Field(ge=0)
    orcamento_mensal: float = Field(ge=0)


class Pessoa(Modelo):
    id: int = Field(ge=0)
    nome: str
    papel: str
    acumulado: float = Field(ge=0)
    premissas: PremissasPessoa


class Cadeira(Modelo):
    papel: str
    titular: int = Field(ge=0)
    candidatos: list[int]


class Posicao(Modelo):
    dia: int = Field(ge=0)
    slot: int = Field(ge=0)


class Cerimonia(Modelo):
    id: int = Field(ge=0)
    projeto_id: int = Field(ge=0)
    projeto: str
    tipo: str
    dur: int = Field(ge=1)
    slots: int = Field(ge=1)
    cadeiras: list[Cadeira] = Field(min_length=1)
    obrigatoria: bool
    prio: int
    sla: bool
    score: float
    ancora: Posicao | None = None
    vigente: Posicao | None = None


class Dica(Modelo):
    cerimonia_id: int = Field(ge=0)
    dia: int = Field(ge=0)
    slot: int = Field(ge=0)
    relaxada: bool
    participantes: list[int]


class Opcoes(Modelo):
    limite_segundos: float = Field(default=60, gt=0)
    workers: int = Field(default=8, ge=1)
    semente: int = Field(default=0, ge=0)
    avaliar_dica: bool = True


class RequisicaoSemana(Modelo):
    versao: Literal["1"]
    semana: int = Field(ge=1)
    grade: Grade
    geral: Geral
    perfil: Perfil
    peso_estabilidade: float = Field(ge=0)
    permitir_troca: bool
    permitir_relaxar: bool
    pessoas: list[Pessoa]
    cerimonias: list[Cerimonia]
    dica: list[Dica] | None = None
    opcoes: Opcoes | None = None


# ─────────────────────────── resposta ───────────────────────────


class Troca(Modelo):
    de: int = Field(ge=0)
    para: int = Field(ge=0)
    papel: str


class Alocacao(Modelo):
    cerimonia_id: int = Field(ge=0)
    dia: int = Field(ge=0)
    slot: int = Field(ge=0)
    camada: Literal[1, 2, 3]
    participantes: list[int]
    trocas: list[Troca]
    relaxada: bool
    ancorada: bool


class NaoAlocada(Modelo):
    cerimonia_id: int = Field(ge=0)
    motivo: str


class Concessao(Modelo):
    cerimonia_id: int = Field(ge=0)
    pessoa_id: int = Field(ge=0)
    premissa: str
    alvo: float
    valor: float
    un: str


class Estatisticas(Modelo):
    variaveis: int = Field(ge=0)
    restricoes: int = Field(ge=0)
    workers: int = Field(ge=0)
    conflitos: int = Field(ge=0)
    ramos: int = Field(ge=0)
    tempo_solver: float = Field(ge=0)


class RespostaSemana(Modelo):
    versao: Literal["1"]
    status: Status
    objetivo: float | None
    limite_inferior: float | None
    objetivo_dica: float | None
    ms: float = Field(ge=0)
    alocadas: list[Alocacao]
    nao_alocadas: list[NaoAlocada]
    concessoes: list[Concessao]
    estatisticas: Estatisticas
