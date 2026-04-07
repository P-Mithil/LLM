from __future__ import annotations

from dataclasses import dataclass

import requests


@dataclass(frozen=True)
class SupabaseConfig:
    url: str
    anon_key: str
    service_role_key: str = ""


class Postgrest:
    """
    Minimal PostgREST client using `requests`.

    We intentionally avoid the `supabase` Python package to keep Windows installs easy
    (no native build deps).
    """

    def __init__(self, cfg: SupabaseConfig):
        self._base = cfg.url.rstrip("/") + "/rest/v1"
        self._key = cfg.service_role_key or cfg.anon_key

    def _headers(self, extra: dict | None = None) -> dict:
        h = {
            "apikey": self._key,
            "Authorization": f"Bearer {self._key}",
        }
        if extra:
            h.update(extra)
        return h

    def select(self, table: str, *, select: str = "*", params: dict | None = None, single: bool = False):
        p = {"select": select}
        if params:
            p.update(params)
        headers = self._headers(
            {"Accept": "application/vnd.pgrst.object+json"} if single else None
        )
        r = requests.get(f"{self._base}/{table}", headers=headers, params=p, timeout=15)
        r.raise_for_status()
        return r.json()

    def insert(self, table: str, row: dict, *, returning: str = "*", single: bool = False):
        headers = self._headers(
            {
                "Prefer": "return=representation",
                "Accept": "application/vnd.pgrst.object+json" if single else "application/json",
                "Content-Type": "application/json",
            }
        )
        params = {"select": returning} if returning else None
        r = requests.post(f"{self._base}/{table}", headers=headers, params=params, json=row, timeout=15)
        r.raise_for_status()
        return r.json()

    def upsert(self, table: str, row: dict, *, on_conflict: str, returning: str = "*", single: bool = False):
        headers = self._headers(
            {
                "Prefer": "resolution=merge-duplicates,return=representation",
                "Accept": "application/vnd.pgrst.object+json" if single else "application/json",
                "Content-Type": "application/json",
            }
        )
        params = {"on_conflict": on_conflict, "select": returning}
        r = requests.post(f"{self._base}/{table}", headers=headers, params=params, json=row, timeout=15)
        r.raise_for_status()
        return r.json()


def postgrest_admin(cfg: SupabaseConfig) -> Postgrest:
    return Postgrest(cfg)

