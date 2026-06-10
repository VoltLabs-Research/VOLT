from __future__ import annotations

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    import pandas as pd
    from voltsdk.http import HttpTransport

class ListingCollection:

    def __init__(
        self,
        client: HttpTransport,
        path: str,
        params: dict | None = None,
    ) -> None:
        self._client = client
        self._path = path
        self._params = params or {}
        self._meta: dict | None = None

    def _fetch(
        self,
        page: int = 1,
        limit: int = 200,
        sort_asc: bool = True,
    ) -> dict:
        params = {
            **self._params,
            'page': page,
            'limit': limit,
            'sortAsc': sort_asc,
        }
        response = self._client.get(self._path, params=params)
        if isinstance(response, dict):
            self._meta = response.get('_meta', self._meta)
        return response

    @property
    def columns(self) -> list[str]:
        if self._meta is None:
            self._fetch(page=1, limit=1)
        return [c['label'] for c in (self._meta or {}).get('columns', [])]

    def to_dataframe(
        self,
        sort_asc: bool = True,
        columns: list[str] | None = None,
    ) -> pd.DataFrame:
        import pandas as _pd

        all_rows: list[dict] = []
        page = 1
        while True:
            response = self._fetch(page=page, limit=200, sort_asc=sort_asc)
            rows = response.get('data', []) if isinstance(response, dict) else []
            if not rows:
                break
            all_rows.extend(rows)
            total_pages = response.get('totalPages', 1) if isinstance(response, dict) else 1
            if page >= total_pages:
                break
            page += 1

        df = _pd.DataFrame(all_rows)
        if columns and not df.empty:
            available = [c for c in columns if c in df.columns]
            df = df[available]
        return df

    def to_csv(self, path: str | None = None) -> str:
        return self._client.download_stream(
            self._path + '/export',
            fallback_name='listings.csv',
            params={**self._params, 'format': 'csv'},
        )

    def __repr__(self) -> str:
        return f'<ListingCollection path={self._path!r}>'

class TrajectoryListingProxy:

    def __init__(self, client: HttpTransport, trajectory) -> None:
        self._client = client
        self._trajectory = trajectory

    def to_dataframe(self, **kwargs) -> pd.DataFrame:
        import pandas as _pd

        dfs: list[_pd.DataFrame] = []
        for analysis in self._trajectory.analyses:
            if analysis.raw.get('status') != 'completed':
                continue
            try:
                df = analysis.listings.to_dataframe(**kwargs)
                if not df.empty:
                    df['_analysis'] = analysis.raw.get('pluginDisplayName', '')
                    df['_analysis_id'] = analysis.id
                    dfs.append(df)
            except Exception:
                continue

        if not dfs:
            return _pd.DataFrame()
        return _pd.concat(dfs, ignore_index=True)

    def __repr__(self) -> str:
        return f'<TrajectoryListingProxy trajectory={self._trajectory.id}>'
