import os
import tempfile
from pathlib import Path

# Point the app at a throwaway DB BEFORE any app modules are imported.
_tmp = tempfile.mkdtemp(prefix="openfeed-test-")
os.environ["OPENFEED_DATA_DIR"] = _tmp
os.environ["OPENFEED_DATABASE_URL"] = f"sqlite:///{Path(_tmp) / 'test.db'}"
os.environ["OPENFEED_DISABLE_POLLER"] = "1"

import pytest
from fastapi.testclient import TestClient

from app.database import init_db
from app.main import app


@pytest.fixture(scope="session")
def client():
    init_db()
    with TestClient(app, raise_server_exceptions=True) as c:
        yield c
