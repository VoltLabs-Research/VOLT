# https://atomsk.univ-lille.fr/doc/en/mode_create.html
class AtomicStructure:
    def __init__(lattice: str, lattice_params: list[float], species: list[int], orientations: tuple[int]):
        self.lattice = lattice
        self.lattice_params = lattice_params
        self.species = species
        self.orientations = orientations

class DislocationBuilder:
    pass