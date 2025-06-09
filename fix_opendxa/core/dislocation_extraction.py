from utils.linalg import normalize
import numpy as np
import math

class DislocationExtractionAlgorithm:
    def __init__(self):
        self._timestep = 0
        self._processor = 0
        self._pbc = [False, False, False]
        self._simulation_cell = np.zeros((3, 3), dtype=float)
        self._simulation_cell_origin: np.ndarray = np.zeros(3, dtype=float)
        self._reciprocal_simulation_cell: np.ndarray = np.zeros((3, 3), dtype=float)

    def set_pbc(self, pbc_x: bool, pbc_y: bool, pbc_z: bool):
        self._pbc[0] = pbc_x
        self._pbc[1] = pbc_y
        self._pbc[2] = pbc_z

    def set_timestep(self, timestep: int):
        self._timestep = timestep

    @property
    def pbc_flags(self):
        return self._pbc
    
    @property
    def has_periodic_boundaries(self):
        return self._pbc[0] or self._pbc[1] or self._pbc[2]
    
    def wrap_vector(self, vector: np.ndarray):
        result = np.copy(vector)
        reduced_vector = np.dot(self._reciprocal_simulation_cell, vector)

        while reduced_vector[0] > 0.5 and self._pbc[0]:
            reduced_vector[0] -= 1.0
            result -= self._simulation_cell[:, 0]

        while reduced_vector[0] < -0.5 and self._pbc[0]:
            reduced_vector[0] += 1.0
            result += self._simulation_cell[:, 0]

        while reduced_vector[1] > 0.5 and self._pbc[1]:
            reduced_vector[1] -= 1.0
            result -= self._simulation_cell[:, 1]

        while reduced_vector[1] < -0.5 and self._pbc[1]:
            reduced_vector[1] += 1.0
            result += self._simulation_cell[:, 1]

        while reduced_vector[2] > 0.5 and self._pbc[2]:
            reduced_vector[2] -= 1.0
            result -= self._simulation_cell[:, 2]
        
        while reduced_vector[2] < -0.5 and self._pbc[2]:
            reduced_vector[2] += 1.0
            result += self._simulation_cell[:, 2]

        return result
    
    def wrap_reduced_vector(self, reduced_vector: np.ndarray) -> np.ndarray:
        while reduced_vector[0] > 0.5 and self._pbc[0]:
            reduced_vector[0] -= 1.0
        while reduced_vector[0] < -0.5 and self._pbc[0]:
            reduced_vector[0] += 1.0

        while reduced_vector[1] > 0.5 and self._pbc[1]:
            reduced_vector[1] -= 1.0
        while reduced_vector[1] < -0.5 and self._pbc[1]:
            reduced_vector[1] += 1.0

        while reduced_vector[2] > 0.5 and self._pbc[2]:
            reduced_vector[2] -= 1.0
        while reduced_vector[2] < -0.5 and self._pbc[2]:
            reduced_vector[2] += 1.0

        return reduced_vector
    
    def is_wrapped_vector(self, vector: np.ndarray) -> bool:
        reduced_vector = np.dot(self._reciprocal_simulation_cell, vector)
        if self._pbc[0] and abs(reduced_vector[0]) > 0.5:
            return True
        
        if self._pbc[1] and abs(reduced_vector[1]) > 0.5:
            return True
        
        if self._pbc[2] and abs(reduced_vector[2]) > 0.5:
            return True
        
        return False
    
    def is_reduced_wrapper_vector(self, vector: np.ndarray) -> bool:
        if self._pbc[0] and abs(vector[0]) > 0.5:
            return True
        
        if self._pbc[1] and abs(vector[1]) > 0.5:
            return True
        
        if self._pbc[2] and abs(vector[2]) > 0.5:
            return True
        
        return False
    
    def periodic_image(self, p: np.ndarray) -> np.ndarray:
        rp = np.dot(self._reciprocal_simulation_cell, (p - self._simulation_cell_origin))
        ix = int(math.floor(rp[0])) if self._pbc[0] else 0
        iy = int(math.floor(rp[1])) if self._pbc[1] else 0
        iz = int(math.floor(rp[2])) if self._pbc[2] else 0
        return np.array([ix, iy, iz], dtype=int)
    
    def wrap_point(self, p: np.ndarray) -> np.ndarray:
        result = np.copy(p)
        rp = np.dot(self._reciprocal_simulation_cell, (p - self._simulation_cell_origin))

        while rp[0] >= 1.0 and self._pbc[0]:
            rp[0] -= 1.0
            result -= self._simulation_cell[:, 0]

        while rp[0] < 0.0 and self._pbc[0]:
            rp[0] += 1.0
            result += self._simulation_cell[:, 0]

        while rp[1] >= 1.0 and self._pbc[1]:
            rp[1] -= 1.0
            result -= self._simulation_cell[:, 1]

        while rp[1] < 0.0 and self._pbc[1]:
            rp[1] += 1.0
            result += self._simulation_cell[:, 1]

        while rp[2] >= 1.0 and self._pbc[2]:
            rp[2] -= 1.0
            result -= self._simulation_cell[:, 2]

        while rp[2] < 0.0 and self._pbc[2]:
            rp[2] += 1.0
            result += self._simulation_cell[:, 2]

        return result
    
    def wrap_reduced_point(self, p: np.ndarray) -> np.ndarray:
        while p[0] >= 1.0 and self._pbc[0]:
            p[0] -= 1.0
        while p[0] < 0.0 and self._pbc[0]:
            p[0] += 1.0

        while p[1] >= 1.0 and self._pbc[1]:
            p[1] -= 1.0
        while p[1] < 0.0 and self._pbc[1]:
            p[1] += 1.0

        while p[2] >= 1.0 and self._pbc[2]:
            p[2] -= 1.0
        while p[2] < 0.0 and self._pbc[2]:
            p[2] += 1.0

        return p
    
    def read_simulation_cell(self, stream) -> bool:
        line_content = stream.line()
        if 'ITEM: TIMESTEP' in line_content:
            timestep_line = stream.readline()
            try:
                timestep = int(timestep_line)
            except ValueError:
                raise ValueError(f'File parsing error. Invalid timestep number (line {stream.line_number()}): {timestep_line}')
            
            if timestep != self._timestep:
                return False
            return True
        
        elif line_content.startswith('ITEM: BOX BOUNDS xy xz yz'):
            sub_str = line_content.replace('ITEM: BOX BOUNDS xy xz yz', '').strip()
            tokens = sub_str.split()
            if len(tokens) == 3:
                self.pbc[0] = (tokens[0] == 'pp')
                self.pbc[1] = (tokens[1] == 'pp')
                self.pbc[2] = (tokens[2] == 'pp')

            # Read lines with LAMMPS triclinic infox
            tilt_factors = np.zeros(3, dtype=float)
            sim_box = np.zeros((2, 3), dtype=float)
            for k in range(3):
                box_line = stream.readline().strip()
                parts = box_line.split()
                if len(parts) != 3:
                    raise ValueError(f'File parsing error. Invalid box size in line {stream.line_number()} of dump file: {box_line}')
                sim_box[0, k] = float(parts[0])
                sim_box[1, k] = float(parts[1])
                tilt_factors[k] = float(parts[2])

            # Adjust bounding box
            # replicate the original C++ logic
            xmins = [
                sim_box[0, 0],
                sim_box[0, 0] + tilt_factors[0],
                sim_box[0, 0] + tilt_factors[1],
                sim_box[0, 0] + tilt_factors[0] + tilt_factors[1],
            ]
            xmaxs = [
                sim_box[1, 0],
                sim_box[1, 0] + tilt_factors[0],
                sim_box[1, 0] + tilt_factors[1],
                sim_box[1, 0] + tilt_factors[0] + tilt_factors[1],
            ]

            low_x = min(xmins)
            high_x = max(xmaxs)
            
            # similarly for y with tilt_factors[2] in mind
            ymins = [sim_box[0, 1], sim_box[0, 1] + tilt_factors[2]]
            ymaxs = [sim_box[1, 1], sim_box[1, 1] + tilt_factors[2]]
            
            low_y = min(ymins)
            high_y = max(ymaxs)

            self._simulation_cell_origin[0] = sim_box[0, 0]
            self._simulation_cell_origin[1] = sim_box[0, 1]
            self._simulation_cell_origin[2] = sim_box[0, 2]

            # column(0)
            self._simulation_cell[:, 0] = np.array([
                sim_box[1, 0] - sim_box[0, 0],
                0.0,
                0.0
            ], dtype=float)
            
            # column(1)
            self._simulation_cell[:, 1] = np.array([
                tilt_factors[0],
                sim_box[1, 1] - sim_box[0, 1],
                0.0
            ], dtype=float)

            # column(2)
            self._simulation_cell[:, 2] = np.array([
                tilt_factors[1],
                tilt_factors[2],
                sim_box[1, 2] - sim_box[0, 2]
            ], dtype=float)

            return True

        elif line_content.startswith('ITEM: BOX BOUNDS'):
            # Attempt to parse boundary condition flags
            sub_str = line_content.replace('ITEM: BOX BOUNDS', '').strip()
            tokens = sub_str.split()
            if len(tokens) == 3:
                self._pbc[0] = (tokens[0] == 'pp')
                self._pbc[1] = (tokens[1] == 'pp')
                self._pbc[2] = (tokens[2] == 'pp')

            # Now read 3 lines of box size
            sim_box = np.zeros((2, 3), dtype=float)
            for k in range(3):
                box_line = stream.readline().strip()
                parts = box_line.split()
                if len(parts) != 2:
                    raise ValueError(f'File parsing error. Invalid box size in line {stream.line_number()} of dump file: {box_line}')
                sim_box[0, k] = float(parts[0])
                sim_box[1, k] = float(parts[1])

            self._simulation_cell_origin[0] = sim_box[0, 0]
            self._simulation_cell_origin[1] = sim_box[0, 1]
            self._simulation_cell_origin[2] = sim_box[0, 2]

            # Orthogonal bounding box
            self._simulation_cell[:, 0] = np.array([
                sim_box[1, 0] - sim_box[0, 0],
                0.0,
                0.0
            ], dtype=float)

            self._simulation_cell[:, 1] = np.array([
                0.0,
                sim_box[1, 1] - sim_box[0, 1],
                0.0
            ], dtype=float)

            self._simulation_cell[:, 2] = np.array([
                0.0,
                0.0,
                sim_box[1, 2] - sim_box[0, 2]
            ], dtype=float)
            return True

        elif 'ITEM: PERIODIC BOUNDARY CONDITIONS' in line_content:
            # Next line has pbc flags as integers
            boundary_line = stream.readline().strip()
            parts = boundary_line.split()
            if len(parts) != 3:
                raise ValueError(f'File parsing error. Invalid periodic boundary condition flags in line {stream.line_number} of dump file: {boundary_line}')
            pbc_flags = [int(x) for x in parts]
            self._pbc[0] = bool(pbc_flags[0])
            self._pbc[1] = bool(pbc_flags[1])
            self._pbc[2] = bool(pbc_flags[2])
            return True

        return False
    
    def write_simulation_cell_header(self, stream):
        stream.write("ITEM: TIMESTEP\n")
        stream.write(f"{self.timestep}\n")

        if (abs(self._simulation_cell[0, 1]) < 1e-12 and
            abs(self._simulation_cell[0, 2]) < 1e-12 and
            abs(self._simulation_cell[1, 2]) < 1e-12 and
            abs(self._simulation_cell[1, 0]) < 1e-12 and
            abs(self._simulation_cell[2, 0]) < 1e-12 and
            abs(self._simulation_cell[2, 1]) < 1e-12):
            stream.write("ITEM: BOX BOUNDS")
            if self._pbc[0]:
                stream.write(" pp")
            else:
                stream.write(" ff")
            if self._pbc[1]:
                stream.write(" pp")
            else:
                stream.write(" ff")
            if self._pbc[2]:
                stream.write(" pp")
            else:
                stream.write(" ff")
            stream.write("\n")
            xlo = self._simulation_cell_origin[0]
            xhi = xlo + self._simulation_cell[0, 0]
            ylo = self._simulation_cell_origin[1]
            yhi = ylo + self._simulation_cell[1, 1]
            zlo = self._simulation_cell_origin[2]
            zhi = zlo + self._simulation_cell[2, 2]

            stream.write(f"{xlo} {xhi}\n")
            stream.write(f"{ylo} {yhi}\n")
            stream.write(f"{zlo} {zhi}\n")

        else:
            # Triclinic box
            stream.write("ITEM: BOX BOUNDS xy xz yz")
            if self._pbc[0]:
                stream.write(" pp")
            else:
                stream.write(" ff")
            if self._pbc[1]:
                stream.write(" pp")
            else:
                stream.write(" ff")
            if self._pbc[2]:
                stream.write(" pp")
            else:
                stream.write(" ff")
            stream.write("\n")

            xlo = self._simulation_cell_origin[0]
            ylo = self._simulation_cell_origin[1]
            zlo = self._simulation_cell_origin[2]
            xhi = xlo + self._simulation_cell[0, 0]
            yhi = ylo + self._simulation_cell[1, 1]
            zhi = zlo + self._simulation_cell[2, 2]
            xy = self._simulation_cell[0, 1]
            xz = self._simulation_cell[0, 2]
            yz = self._simulation_cell[1, 2]

            xlo_min = min(xlo, xlo + xy, xlo + xz, xlo + xy + xz)
            xhi_max = max(xhi, xhi + xy, xhi + xz, xhi + xy + xz)
            ylo_min = min(ylo, ylo + yz)
            yhi_max = max(yhi, yhi + yz)

            stream.write(f"{xlo_min} {xhi_max} {xy}\n")
            stream.write(f"{ylo_min} {yhi_max} {xz}\n")
            stream.write(f"{zlo} {zhi} {yz}\n")
    
    def setup_simulation_cell(self, cutoff_radius: float):
        try:
            self._reciprocal_simulation_cell = np.linalg.inv(self._simulation_cell)
        except np.linalg.LinAlgError:
            raise ValueError('Simulation Cell is singular or not invertibe.')
        
        if cutoff_radius <= 0.0:
            raise ValueError('Cuttoff Radius must be > 0.')
        
        for i in range(0, 3):
            col_vec = self._simulation_cell[:, i]
            col_length = np.linalg.norm(col_vec)
            bin_dim = int(col_length / cutoff_radius)
            if bin_dim < 1 and self._pbc[i]:
                raise ValueError('Periodic simulatio cell is smaller than the neighbor cutoff radius. Minimum image convention cannot be used with such a small simulation box.')
            
        for i in range(0, 3):
            i1 = (i + 1) % 3
            i2 = (i + 2) % 3
            col_i1 = self.simulationCell[:, i1]
            col_i2 = self.simulationCell[:, i2]

            normal = np.cross(col_i1, col_i2)
            normal = normalize(normal)

            dot_val = float(np.dot((normal, self.simulationCell[:, i])))
            if dot_val <= (cutoff_radius * 2):
                raise ValueError("Simulation cell is too narrow. Cell size must be at least twice the cutoff radius.")