from __future__ import annotations

import unittest
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from voltsdk.resources.base import BaseCollection, BaseResource


class _Item(BaseResource):
    @property
    def value(self) -> int:
        return self._get('value', -1)


class _FakeTransport:
    """Serves a fixed list of rows as paginated ``{data, total}`` responses."""

    def __init__(self, count: int) -> None:
        self.rows = [{'_id': str(i), 'value': i} for i in range(count)]
        self.calls = 0

    def get(self, path: str, params: dict | None = None) -> dict:
        self.calls += 1
        params = params or {}
        page = params['page']
        limit = params['limit']
        start = (page - 1) * limit
        return {'data': self.rows[start:start + limit], 'total': len(self.rows)}


def _collection(count: int, page_size: int = 2) -> tuple[BaseCollection, _FakeTransport]:
    transport = _FakeTransport(count)
    collection = BaseCollection(transport, path='/items', resource_cls=_Item, page_size=page_size)
    return collection, transport


class BaseCollectionTests(unittest.TestCase):
    def test_iterates_all_items_in_order(self) -> None:
        collection, _ = _collection(5)
        self.assertEqual([item.value for item in collection], [0, 1, 2, 3, 4])

    def test_second_iteration_uses_cache_without_refetching(self) -> None:
        collection, transport = _collection(5, page_size=2)
        first = [item.value for item in collection]
        calls_after_first = transport.calls
        second = [item.value for item in collection]
        self.assertEqual(first, second)
        self.assertEqual(transport.calls, calls_after_first)

    def test_iteration_wraps_each_item_once(self) -> None:
        collection, _ = _collection(3)
        first_pass = list(collection)
        second_pass = list(collection)
        for a, b in zip(first_pass, second_pass):
            self.assertIs(a, b)

    def test_list_eager_materialization(self) -> None:
        collection, _ = _collection(4)
        self.assertEqual([i.value for i in collection.list()], [0, 1, 2, 3])

    def test_first(self) -> None:
        collection, _ = _collection(3)
        self.assertEqual(collection.first().value, 0)
        empty, _ = _collection(0)
        self.assertIsNone(empty.first())

    def test_exact_multiple_of_page_size_terminates(self) -> None:
        collection, transport = _collection(4, page_size=2)
        self.assertEqual([i.value for i in collection], [0, 1, 2, 3])


if __name__ == '__main__':
    unittest.main()
