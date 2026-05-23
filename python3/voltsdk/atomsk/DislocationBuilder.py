from typing import Union
from enum import Enum
from .lattices import CubicLattices, TetragonalLattices, HexagonalLattices

# https://atomsk.univ-lille.fr/doc/en/mode_create.html
class AtomicStructure:
    def __init__(
        self,
        lattice: Union[CubicLattices | TetragonalLattices | HexagonalLattices], 
        lattice_params: list[float], 
        species: list[int],
        orient: tuple[int],
        duplicate: tuple[int],
        export_filename: str
    ):
        self.lattice = lattice
        self.lattice_params = lattice_params
        self.species = species
        self.orientations = orientations

# From examples: https://atomsk.univ-lille.fr/doc/en/mode_create.html
# atomsk --create fcc 4.02 Al orient [0-11] [100] [011] -duplicate 40 30 30 al_supercell.cfg lmp
'''
Al_supercell = AtomicStructure(
    lattice=CubicLattices.FCC
    lattice_params=[4.02],
    orient=[(0, -11), (1, 0, 0), (0, 1, 1)],
    duplicate=(40, 30, 30),
    export_filename='al_supercell.lmp'
)
'''

class DislocationCharacter(Enum):
    EDGE = 'edge'
    SCREW = 'screw'
    GLIDE = 'loop'
    # MIXED = 'mixed'

class DislocationBuilder:
    # coords: Coordinates of the dislocation in the plane normal to the dislocation line.
    # dir: Direction of the dislocation line (x, y or z).
    # n: Direction normal to the plane of cut. (x, y or z and different from dir).
    # b: norm of the Burgers vector.
    # v: Poission ratio of the material. Must be provided for edge dislocations.
    def __init__(
        atomic_structure: AtomicStructure, 
        character: DislocationCharacter,
        coords: tuple[float],
        dir: float,
        n: float
        b: tuple[float],
        v: float
    ):
        self.atomic_structure = atomic_structure
        self.character = DislocationCharacter

'''
screw_disl = DislocationBuilder(
    atomic_structure=Al_supercell,
    character=DislocationCharacter.SCREW,
    coords=[0.501, 0.501, 0.501]
)
'''