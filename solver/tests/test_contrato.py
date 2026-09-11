"""O Pydantic não pode divergir do JSON Schema, que é a fonte única do contrato."""

from __future__ import annotations

import json
from pathlib import Path

import pytest
from pydantic import BaseModel

from cadencia_solver import contrato

ESQUEMA = json.loads((Path(__file__).parents[1] / "contrato" / "semana.schema.json").read_text())
MODELOS = {
    nome: obj
    for nome, obj in vars(contrato).items()
    if isinstance(obj, type)
    and issubclass(obj, BaseModel)
    and obj.__module__ == contrato.__name__
    and obj is not contrato.Modelo
}


def test_todo_modelo_tem_definicao_e_vice_versa():
    assert set(MODELOS) == set(ESQUEMA["$defs"])


@pytest.mark.parametrize("nome", sorted(MODELOS))
def test_campos_e_obrigatorios_iguais(nome: str):
    definicao = ESQUEMA["$defs"][nome]
    gerado = MODELOS[nome].model_json_schema(by_alias=True)
    assert set(gerado["properties"]) == set(definicao["properties"]), nome
    assert set(gerado.get("required", [])) == set(definicao.get("required", [])), nome
    assert definicao.get("additionalProperties") is False
