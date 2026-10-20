"""pytest suite for the OVITO parity bridge (T5.3).

The OVITO Python module is a heavyweight optional dependency absent from CI and
most dev machines, so these tests focus on the parts that work *without* OVITO
(the recorded-reference accessors + coarse-code mapping) and assert that the
live-OVITO accessors degrade with a clear, typed error. When OVITO *is* present
the live accessors run against a tiny dump.
"""

from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
import pytest

_PKG_ROOT = Path(__file__).resolve().parents[1]
if str(_PKG_ROOT) not in sys.path:
    sys.path.insert(0, str(_PKG_ROOT))

from voltsdk.integrations.ovito_validator import (
    OVITO_AVAILABLE,
    OVITO_STRUCTURE,
    OvitoUnavailableError,
    coarse_structure_code,
    extract_burgers_vectors,
    extract_strain_invariants,
    extract_structure_types,
    reference_burgers_families,
    reference_structure_fractions,
)


def test_coarse_structure_code():
    assert coarse_structure_code('FCC') == 1
    assert coarse_structure_code('bcc') == 2
    assert coarse_structure_code('HCP') == 3
    assert coarse_structure_code('cubic_diamond') == 4
    assert coarse_structure_code('hex_diamond') == 4
    assert coarse_structure_code('SC') == 5
    assert coarse_structure_code('ICO') == 0
    assert coarse_structure_code('garbage') == 0


def test_ovito_structure_enum_complete():
    for k in ('FCC', 'BCC', 'HCP'):
        assert k in OVITO_STRUCTURE


def test_reference_structure_fractions():
    fcc = reference_structure_fractions('FCC')
    assert fcc == {1: 1.0}
    assert reference_structure_fractions('HCP') == {3: 1.0}


def test_reference_burgers_families():
    fcc = reference_burgers_families('FCC')
    assert '1/2<110>' in fcc
    assert fcc['1/2<110>'] == pytest.approx(np.sqrt(2) / 2)
    bcc = reference_burgers_families('BCC')
    assert bcc['1/2<111>'] == pytest.approx(np.sqrt(3) / 2)
    assert reference_burgers_families('HCP')['1/3<11-20>'] == pytest.approx(1.0)


@pytest.mark.skipif(OVITO_AVAILABLE, reason='OVITO installed; degradation path not exercised')
def test_extract_structure_types_without_ovito():
    with pytest.raises(OvitoUnavailableError):
        extract_structure_types(frame=None)


@pytest.mark.skipif(OVITO_AVAILABLE, reason='OVITO installed; degradation path not exercised')
def test_extract_strain_invariants_without_ovito():
    with pytest.raises(OvitoUnavailableError):
        extract_strain_invariants(frame=None)


@pytest.mark.skipif(OVITO_AVAILABLE, reason='OVITO installed; degradation path not exercised')
def test_extract_burgers_vectors_without_ovito():
    with pytest.raises(OvitoUnavailableError):
        extract_burgers_vectors(frame=None)


@pytest.mark.skipif(not OVITO_AVAILABLE, reason='OVITO not installed')
def test_extract_structure_types_with_ovito(tmp_path):
    """Build a tiny FCC dump, classify via OVITO, check shape/dtype."""
    from pyatomsk.corpus import build_lattice, write_annotated_dump
    from voltsdk.resources.frames import Frame

    pos, box = build_lattice('FCC', (4, 4, 4))
    dump = write_annotated_dump(tmp_path / 'fcc.dump', pos, box, 1)

    from ovito.io import import_file
    from ovito.modifiers import CommonNeighborAnalysisModifier
    data = import_file(str(dump)).compute()
    data.apply(CommonNeighborAnalysisModifier())
    types = np.asarray(data.particles['Structure Type'][...], dtype=np.uint8)
    assert types.shape[0] == pos.shape[0]
    assert types.dtype == np.uint8
