import numpy as np

class IteratorBase:
    def __init__(self, neighbor_list, particle, center):
        self._list = neighbor_list
        self.center = particle.pos if particle else center
        self.centerindex = particle
        self.dir = [-2, 1, 1]
        self.centerbin = [0, 0, 0]
        self.currentbin = [0, 0, 0]
        self.binatom = None
        self.neighborindex = None
        self._delta = np.zeros(3, dtype=float)
        self.distsq = 0.0

    def at_end(self):
        return self.dir[0] > 1

    def current(self):
        return self.neighborindex

    def delta(self):
        return self._delta

    def distance_squared(self):
        return self.distsq

class Iterator(IteratorBase):
    def __init__(self, neighbor_list, particle, center=None):
        if center is None:
            center = np.zeros(3, dtype=float)
        super().__init__(neighbor_list, particle, center)
        reducedp = np.dot(self._list.reciprocal_bin_cell, self.center - self._list.bin_origin)
        for k in range(3):
            self.centerbin[k] = int(np.floor(reducedp[k]))
            if self._list.pbc[k]:
                while self.centerbin[k] < 0:
                    self.centerbin[k] += self._list.bin_dim[k]
                while self.centerbin[k] >= self._list.bin_dim[k]:
                    self.centerbin[k] -= self._list.bin_dim[k]
            else:
                self.centerbin[k] = max(min(self.centerbin[k], self._list.bin_dim[k] - 1), 0)
            assert 0 <= self.centerbin[k] < self._list.bin_dim[k]
        self.next()

    def __iter__(self):
        return self
    
    def __next__(self):
        n = self.next()
        if n is None:
            raise StopIteration
        return n
    
    def next(self):
        while self.dir[0] != 2:
            while self.binatom:
                self.neighborindex = self.binatom
                self.binatom = self.binatom.next_in_bin
                self._delta = self._list.wrap_vector(self.neighborindex.pos - self.center)
                self.distsq = np.dot(self._delta, self._delta)
                if self.distsq <= self._list.cutoff_squared and self.neighborindex != self.centerindex:
                    return self.neighborindex

            # Update direction
            if self.dir[2] == 1:
                self.dir[2] = -1
                if self.dir[1] == 1:
                    self.dir[1] = -1
                    if self.dir[0] == 1:
                        self.dir[0] += 1
                        self.neighborindex = None
                        return None
                    else:
                        self.dir[0] += 1
                else:
                    self.dir[1] += 1
            else:
                self.dir[2] += 1
            
            k = 0
            for k in range(0, 3):
                self.currentbin[k] = self.centerbin[k] + self.dir[k]
                if self._list.pbc[k]:
                    if self.currentbin[k] == -1:
                        self.currentbin[k] = self._list.bin_dim[k] - 1
                    elif self.currentbin[k] == self._list.bin_dim[k]:
                        self.currentbin[k] = 0
                else:
                    if self.currentbin[k] == -1 or self.currentbin[k] == self._list.bin_dim[k]:
                        break
            if k != 2:
                continue
            bin_index = (
                self.currentbin[2] * self._list.bin_dim[0] * self._list.bin_dim[1] +
                self.currentbin[1] * self._list.bin_dim[0] +
                self.currentbin[0]
            )
            assert 0 <= bin_index < len(self._list.bins)
            self.binatom = self._list.bins[bin_index]
        self.neighborindex = None
        return None

class NeighborListBuilder:
    def __init__(self):
        self.bins = []
        self.cutoff = 0
        self.cutoff_squared = 0
        self.simulation_cell = np.zeros((3, 3), dtype=float)
        self.reciprocal_simulation_cell = np.zeros((3, 3), dtype=float)
        self.reciprocal_bin_cell = np.zeros((3, 3), dtype=float)
        self.pbc = [False, False, False]
        self.bin_origin = np.zeros(3, dtype=float)
        self.bin_dim = [0, 0, 0]

    def initialize(self, cell, cutoff):
        self.cutoff = cutoff
        self.cutoff_squared = cutoff
        self.simulation_cell = np.copy(cell.simulation_cell)
        self.reciprocal_simulation_cell = np.copy(cell.reciprocal_simulation_cell)
        self.bin_origin = np.copy(cell.simulation_cell_origin)
        m = np.eye(3) * cutoff @ cell.reciprocal_simulation_cell
        bin_cell = np.zeros((3, 3), dtype=float)
        for i in range(0, 3):
            col = cell.simulation_cell[:, i]
            m_col = m[:, i]
            bin_length = np.linalg.norm(col)
            bin_dim = int(bin_length / cutoff)
            m_bin_dim = int(1.0 / np.linalg.norm(m_col)) if np.linalg.norm(m_col) > 0 else bin_dim
            self.bin_dim[i] = min(bin_dim, m_bin_dim)
            self.bin_dim[i] = min(self.bin_dim[i], 40)
            self.bin_dim[i] = max(self.bin_dim[i], 1)
            bin_cell[:, i] = col / float(self.bin_dim[i])
            self.pbc[i] = cell.pbc[i]
        self.reciprocal_bin_cell = np.linalg.inv(bin_cell)
        total_bins = self.bin_dim[0] * self.bin_dim[1] * self.bin_dim[2]
        self.bins = [None for _ in range(total_bins)]

    def insert_particle(self, particle):
        rp = np.dot(self.reciprocal_bin_cell, (particle.pos - self.bin_origin))
        bin_coord = [int(np.floor(rp[k])) for k in range(0, 3)]
        for k in range(0, 3):
            if self.pbc[k]:
                while bin_coord[k] < 0:
                    bin_coord[k] += self.bin_dim[k]
                
                while bin_coord[k] >= self.bin_dim[k]:
                    bin_coord[k] -= self.bin_dim[k]

            else:
                bin_coord[k] = max(min(bin_coord[k], self.bin_dim[k] - 1), 0)
            
        bin_index = bin_coord[2] * self.bin_dim[0] * self.bin_dim[1] + bin_coord[1] * self.bin_dim[0] + bin_coord[0]
        assert 0 <= bin_index < len(self.bins), 'bin_index out of range'
        particle.next_in_bin = self.bins[bin_index]
        self.bins[bin_index] = particle

    def are_neighbors(self, particle1, particle2):
        assert particle1 is not particle2
        for neighbor in self.iterator(particle1):
            if neighbor is particle2:
                return True
        return False
    
    def wrap_vector(self, v):
        # TODO: DUPLICATED CODE?
        result = np.copy(v)
        rv = np.dot(self.reciprocal_simulation_cell, v)
        for i in range(3):
            while rv[i] > 0.5 and self.pbc[i]:
                rv[i] -= 1.0
                result -= self.simulation_cell[:, i]
            while rv[i] < -0.5 and self.pbc[i]:
                rv[i] += 1.0
                result += self.simulation_cell[:, i]
        return result
    
    def iterator(self, particle):
        return self.iterator(self, particle)