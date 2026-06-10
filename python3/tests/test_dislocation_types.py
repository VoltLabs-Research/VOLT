from __future__ import annotations

import unittest
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from voltsdk.spatial.geometry import _calculate_dislocation_type


def _segment(vector) -> dict:
    return {'burgers': {'vector': vector}}


class DislocationTypeTests(unittest.TestCase):
    def test_half_111(self) -> None:
        self.assertEqual(_calculate_dislocation_type(_segment([0.5, 0.5, 0.5])), '1/2<111>')

    def test_100(self) -> None:
        self.assertEqual(_calculate_dislocation_type(_segment([1.0, 0.0, 0.0])), '<100>')

    def test_110(self) -> None:
        self.assertEqual(_calculate_dislocation_type(_segment([1.0, 1.0, 0.0])), '<110>')

    def test_111(self) -> None:
        self.assertEqual(_calculate_dislocation_type(_segment([1.0, 1.0, 1.0])), '<111>')

    def test_one_sixth_112(self) -> None:
        self.assertEqual(_calculate_dislocation_type(_segment([0.2, 0.1, 0.1])), '1/6<112>')

    def test_missing_burgers_is_other(self) -> None:
        self.assertEqual(_calculate_dislocation_type({}), 'Other')

    def test_non_vector_burgers_is_other(self) -> None:
        self.assertEqual(_calculate_dislocation_type({'burgers': {'vector': [1.0, 0.0]}}), 'Other')

    def test_sign_independent(self) -> None:
        # Classification uses absolute components, so signs do not matter.
        self.assertEqual(_calculate_dislocation_type(_segment([-1.0, 0.0, 0.0])), '<100>')


if __name__ == '__main__':
    unittest.main()
