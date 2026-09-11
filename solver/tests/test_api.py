from __future__ import annotations

from fabrica import cerimonia, pessoa, requisicao
from fastapi.testclient import TestClient

from cadencia_solver.api import app
from cadencia_solver.contrato import RespostaSemana

cliente = TestClient(app)


def corpo() -> dict:
    req = requisicao([pessoa(0), pessoa(1)], [cerimonia(0, [0, 1], papeis=["Analista", "Especialista"])])
    return req.model_dump(by_alias=True, exclude_none=True)


def test_saude():
    r = cliente.get("/saude")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"
    assert r.json()["versaoContrato"] == "1"


def test_resolver_devolve_o_contrato_em_camel_case():
    r = cliente.post("/resolver", json=corpo())
    assert r.status_code == 200
    dados = r.json()
    assert "naoAlocadas" in dados and "limiteInferior" in dados
    resp = RespostaSemana.model_validate(dados)
    assert resp.status in ("otimo", "viavel")
    assert [a.cerimonia_id for a in resp.alocadas] == [0]


def test_campo_fora_do_contrato_e_recusado():
    dados = corpo()
    dados["inesperado"] = 1
    assert cliente.post("/resolver", json=dados).status_code == 422


def test_token_quando_configurado(monkeypatch):
    monkeypatch.setenv("SOLVER_TOKEN", "segredo")
    assert cliente.post("/resolver", json=corpo()).status_code == 401
    r = cliente.post("/resolver", json=corpo(), headers={"Authorization": "Bearer segredo"})
    assert r.status_code == 200
