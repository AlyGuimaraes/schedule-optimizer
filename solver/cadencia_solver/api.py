"""
Serviço HTTP do solver.

  GET  /saude     vivo, versão do contrato e do OR-Tools
  POST /resolver  uma semana: RequisicaoSemana → RespostaSemana

Autenticação provisória: se `SOLVER_TOKEN` estiver definido, exige `Authorization: Bearer <token>`.
O token assinado do plano depende da decisão de hospedagem (D-11).
"""

from __future__ import annotations

import hmac
import os

import ortools
from fastapi import FastAPI, Header, HTTPException

from .contrato import VERSAO_CONTRATO, RequisicaoSemana, RespostaSemana
from .modelo import resolver_semana

app = FastAPI(title="Cadência · solver CP-SAT", version=VERSAO_CONTRATO)


@app.get("/saude")
def saude() -> dict[str, str]:
    return {"status": "ok", "versaoContrato": VERSAO_CONTRATO, "ortools": ortools.__version__}


@app.post("/resolver", response_model=RespostaSemana)
def resolver(req: RequisicaoSemana, authorization: str | None = Header(default=None)) -> RespostaSemana:
    token = os.environ.get("SOLVER_TOKEN")
    if token and not hmac.compare_digest(authorization or "", f"Bearer {token}"):
        raise HTTPException(status_code=401, detail="token ausente ou inválido")
    # função síncrona: o FastAPI roda em thread e o CP-SAT usa os próprios workers
    return resolver_semana(req)
