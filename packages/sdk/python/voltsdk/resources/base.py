from __future__ import annotations

from typing import Generic, Iterator, TypeVar, TYPE_CHECKING

if TYPE_CHECKING:
    from voltsdk.http import HttpTransport

T = TypeVar('T', bound='BaseResource')

class BaseResource:

    def __init__(self, client: HttpTransport, data: dict) -> None:
        self._client = client
        self._data = data

    @property
    def id(self) -> str:
        return self._data.get('_id', '')

    @property
    def raw(self) -> dict:
        return self._data

    def _get(self, key: str, default=None):
        return self._data.get(key, default)

    def __repr__(self) -> str:
        return f'<{self.__class__.__name__} id={self.id}>'

class BaseCollection(Generic[T]):

    def __init__(
        self,
        client: HttpTransport,
        path: str,
        resource_cls: type[T] | None = None,
        params: dict | None = None,
        page_size: int = 100,
    ) -> None:
        self._client = client
        self._path = path
        self._resource_cls = resource_cls
        self._params = params or {}
        self._page_size = page_size
        self._cache: list[T] = []
        self._fetched_pages: int = 0
        self._reached_end: bool = False

    def __iter__(self) -> Iterator[T]:
        index = 0
        while True:
            if index < len(self._cache):
                yield self._cache[index]
                index += 1
            elif self._fetch_next_page() == 0:
                return

    def list(self) -> list[T]:
        return list(iter(self))

    def first(self) -> T | None:
        for item in self:
            return item
        return None

    def to_dataframe(self):
        import pandas as pd
        return pd.DataFrame([item.raw for item in self])

    def _wrap(self, data: dict) -> T:
        if self._resource_cls is None:
            raise TypeError('_resource_cls must be set on the collection')
        return self._resource_cls(self._client, data)

    def _fetch_next_page(self) -> int:
        if self._reached_end:
            return 0
        params = {**self._params, 'page': self._fetched_pages + 1, 'limit': self._page_size}
        response = self._client.get(self._path, params=params)

        if isinstance(response, dict):
            items = response.get('data', [])
        elif isinstance(response, list):
            items = response
        else:
            items = []
        if not isinstance(items, list):
            items = []

        for item in items:
            self._cache.append(self._wrap(item))
        self._fetched_pages += 1
        if not items or len(items) < self._page_size:
            self._reached_end = True
        return len(items)

    def __repr__(self) -> str:
        return f'<{self.__class__.__name__} fetched={len(self._cache)}>'
