"""OVITO parity bridge for the VOLT validation harness.

The validation harness (``pyatomsk.harness``) needs a *second, independent*
opinion on every quantity VOLT's structure-analysis plugins emit: per-atom
structure type, per-atom strain invariants, and per-segment Burgers vectors.
OVITO 4.x is the reference implementation we measure parity against, so this
module wraps OVITO's modifiers behind three pure-numpy accessors:

* :func:`extract_structure_types`  — CNA / PTM classification (OVITO enum codes)
* :func:`extract_strain_invariants` — volumetric + deviatoric atomic strain
* :func:`extract_burgers_vectors`   — per-segment Burgers vectors + families (DXA)

Degraded mode (OVITO not installed)
-----------------------------------
OVITO ships as a heavyweight binary wheel and an optional DXA plugin; CI runners
and most dev machines will not have it. Rather than make the harness unrunnable,
every accessor here checks :data:`OVITO_AVAILABLE` first. When OVITO is missing
the harness does NOT call these against a live pipeline — instead it compares the
VOLT side against *recorded reference values* baked into the corpus registry
(see ``pyatomsk.corpus``). :func:`reference_structure_fractions` and
:func:`reference_burgers_families` expose the canonical reference numbers so the
harness has a single source of truth whether or not OVITO is present.

The OVITO structure-type enum (``StructureIdentificationModifier``) is the
canonical encoding the whole harness standardises on; :data:`OVITO_STRUCTURE`
documents it so the VOLT-side ``structure_id`` can be remapped onto it.
"""

from __future__ import annotations

from typing import TYPE_CHECKING

import numpy as np

if TYPE_CHECKING:
    from voltsdk.resources.frames import Frame


def _ovito_available() -> bool:
    try:
        import ovito  # noqa: F401
    except Exception:
        return False
    return True


OVITO_AVAILABLE: bool = _ovito_available()

# OVITO's StructureIdentificationModifier common-type enum. Both CNA and PTM
# share the leading codes; PTM adds graphene/cubic-diamond variants we fold into
# the coarse families the harness compares on.
OVITO_STRUCTURE: dict[str, int] = {
    'OTHER': 0,
    'FCC': 1,
    'HCP': 2,
    'BCC': 3,
    'ICO': 4,
    'SC': 5,
    'CUBIC_DIAMOND': 6,
    'HEX_DIAMOND': 7,
    'GRAPHENE': 8,
}

# Coarse harness families (what the parquet `structure_name` collapses to).
_COARSE: dict[str, int] = {
    'OTHER': 0,
    'FCC': 1,
    'BCC': 2,
    'HCP': 3,
    'DIAMOND': 4,
    'SC': 5,
}

# How OVITO's fine enum maps onto the coarse harness families.
_OVITO_TO_COARSE: dict[int, int] = {
    OVITO_STRUCTURE['OTHER']: _COARSE['OTHER'],
    OVITO_STRUCTURE['FCC']: _COARSE['FCC'],
    OVITO_STRUCTURE['HCP']: _COARSE['HCP'],
    OVITO_STRUCTURE['BCC']: _COARSE['BCC'],
    OVITO_STRUCTURE['ICO']: _COARSE['OTHER'],
    OVITO_STRUCTURE['SC']: _COARSE['SC'],
    OVITO_STRUCTURE['CUBIC_DIAMOND']: _COARSE['DIAMOND'],
    OVITO_STRUCTURE['HEX_DIAMOND']: _COARSE['DIAMOND'],
    OVITO_STRUCTURE['GRAPHENE']: _COARSE['OTHER'],
}


def coarse_structure_code(name: str) -> int:
    """Map a structure name (any case, OVITO or VOLT spelling) to a coarse code."""
    key = str(name).strip().upper()
    if key in _COARSE:
        return _COARSE[key]
    # tolerate PSM/PTM spellings
    aliases = {
        'CUBIC_DIAMOND': 'DIAMOND', 'HEX_DIAMOND': 'DIAMOND', 'DIA': 'DIAMOND',
        'SIMPLE_CUBIC': 'SC', 'ICO': 'OTHER', 'NONE': 'OTHER', 'UNKNOWN': 'OTHER',
    }
    return _COARSE.get(aliases.get(key, 'OTHER'), 0)


class OvitoUnavailableError(RuntimeError):
    """Raised when a live-OVITO accessor is invoked but OVITO is not installed."""


def _require_ovito() -> None:
    if not OVITO_AVAILABLE:
        raise OvitoUnavailableError(
            'ovito is not installed; the harness must use recorded reference '
            'values instead. Install with: pip install "voltsdk[ovito]". '
            'Reference accessors (reference_structure_fractions / '
            'reference_burgers_families) work without OVITO.'
        )


# ===========================================================================
#  Live-OVITO accessors (used only when OVITO_AVAILABLE)
# ===========================================================================
def extract_structure_types(frame: Frame, classifier: str = 'PTM') -> np.ndarray:
    """Per-atom structure-type codes for ``frame`` via OVITO (OVITO enum).

    ``classifier`` is ``'PTM'`` (PolyhedralTemplateMatching) or ``'CNA'``
    (CommonNeighborAnalysis). Returns an ``(N,)`` ``uint8`` array of
    :data:`OVITO_STRUCTURE` codes. Raises :class:`OvitoUnavailableError` if OVITO
    is missing — the caller is expected to fall back to recorded references.
    """
    _require_ovito()
    from voltsdk.integrations.ovito import frame_to_data

    if classifier.upper() == 'PTM':
        from ovito.modifiers import PolyhedralTemplateMatchingModifier as _Mod
    else:
        from ovito.modifiers import CommonNeighborAnalysisModifier as _Mod

    data = frame_to_data(frame)
    data.apply(_Mod())
    return np.asarray(data.particles['Structure Type'][...], dtype=np.uint8)


def extract_strain_invariants(frame: Frame, cutoff: float = 3.5) -> dict[str, np.ndarray]:
    """Per-atom volumetric + deviatoric strain invariants via OVITO.

    Uses OVITO's :class:`AtomicStrainModifier` against the frame's own first
    configuration as reference (self-reference → near-zero strain for a pristine
    lattice, which is exactly the parity baseline). Returns
    ``{'strain_vol': (N,), 'strain_dev_inv': (N,)}`` as ``float32``.
    """
    _require_ovito()
    from voltsdk.integrations.ovito import frame_to_data
    from ovito.modifiers import AtomicStrainModifier

    data = frame_to_data(frame)
    mod = AtomicStrainModifier(cutoff=cutoff)
    mod.output_strain_tensors = True
    data.apply(mod)
    vol = np.asarray(data.particles['Volumetric Strain'][...], dtype=np.float32)
    shear = np.asarray(data.particles['Shear Strain'][...], dtype=np.float32)
    return {'strain_vol': vol, 'strain_dev_inv': shear}


def extract_burgers_vectors(
    frame: Frame, classifier_name: str = 'PTM'
) -> tuple[np.ndarray, np.ndarray]:
    """Per-segment Burgers vectors + family codes via OVITO's DXA.

    Returns ``(vectors: (M,3) float64, families: (M,) int)``. Raises
    :class:`NotImplementedError` if the OVITO DXA modifier is not present in the
    installed OVITO build (the user must install the ``ovito`` DXA plugin), and
    :class:`OvitoUnavailableError` if OVITO itself is missing.
    """
    _require_ovito()
    from voltsdk.integrations.ovito import frame_to_data

    try:
        from ovito.modifiers import DislocationAnalysisModifier
    except Exception as exc:  # pragma: no cover - depends on OVITO build
        raise NotImplementedError(
            'OVITO is installed but its DislocationAnalysisModifier (DXA) is not '
            'available in this build; Burgers parity cannot be computed via OVITO.'
        ) from exc

    structure = (DislocationAnalysisModifier.Lattice.FCC if classifier_name.upper() == 'PTM'
                 else DislocationAnalysisModifier.Lattice.FCC)
    data = frame_to_data(frame)
    data.apply(DislocationAnalysisModifier(input_crystal_structure=structure))
    network = data.dislocations
    vectors = np.array([seg.true_burgers_vector for seg in network.segments], dtype=np.float64) \
        if len(network.segments) else np.empty((0, 3), dtype=np.float64)
    families = np.array([int(seg.cluster_index) for seg in network.segments], dtype=int) \
        if len(network.segments) else np.empty((0,), dtype=int)
    return vectors, families


# ===========================================================================
#  Recorded-reference accessors (always available; used in degraded mode)
# ===========================================================================
def reference_structure_fractions(structure: str) -> dict[int, float]:
    """Expected per-atom structure-type fractions (coarse codes) for a pristine
    lattice of the given crystal ``structure``.

    These are the analytic ground truth — a defect-free FCC lattice classified by
    a correct CNA/PTM is ~100% FCC away from free surfaces; with periodic
    boundaries and a commensurate cell it is exactly 100%. They serve as the
    parity reference when OVITO is unavailable.
    """
    s = str(structure).strip().upper()
    code = coarse_structure_code(s)
    return {code: 1.0}


def reference_burgers_families(structure: str) -> dict[str, float]:
    """Canonical Burgers-vector magnitudes (in units of the lattice parameter
    ``a``) for the dominant perfect-dislocation family of each crystal class.

    Used by the harness to score |b| recovery when no OVITO DXA is present.
    """
    s = str(structure).strip().upper()
    # |b|/a for the dominant perfect dislocation of each lattice.
    table = {
        'FCC': {'1/2<110>': float(np.sqrt(2) / 2)},
        'BCC': {'1/2<111>': float(np.sqrt(3) / 2)},
        'HCP': {'1/3<11-20>': 1.0},
        'DIAMOND': {'1/2<110>': float(np.sqrt(2) / 2)},
        'SC': {'<100>': 1.0},
    }
    return table.get(s, {'<100>': 1.0})
