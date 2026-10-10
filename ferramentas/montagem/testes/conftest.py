"""Os testes da montagem, da raiz do repositório: `uv run --with pytest pytest -p no:cacheprovider ferramentas/montagem/testes`."""
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))  # ferramentas/: o `base` e o pacote `montagem`

from montagem import sons  # noqa: E402


@pytest.fixture(autouse=True)
def _sons_falsos(tmp_path, monkeypatch):
    """A biblioteca de sons de verdade fica fora dos testes (do 18: tests/conftest.py)."""
    monkeypatch.setattr(sons, 'RAIZ', tmp_path / 'sons')
