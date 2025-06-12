import numpy as np
import itertools
from typing import Dict, List, Tuple, Iterator, Union, Optional

class LammpstrjParser:
    '''
    Parser for LAMMPS .lammpstrj and .config trajectory files. Iterates over timesteps
    and extracts atom data for each frame. Supports both standard and triclinic box formats.
    '''
    def __init__(self, filename: str):
        '''
        Initialize the parser with the path to the trajectory file.

        Args:
            filename (str): Path to the LAMMPS trajectory file to parse.
        '''
        self.filename = filename
        self._validate_file()

    def _validate_file(self) -> None:
        '''Validate that the file exists and is readable.'''
        try:
            with open(self.filename, 'r') as f:
                first_line = f.readline()
                if not first_line.startswith('ITEM:'):
                    raise ValueError(f"File {self.filename} doesn't appear to be a LAMMPS trajectory file")
        except FileNotFoundError:
            raise FileNotFoundError(f"File {self.filename} not found")
        except PermissionError:
            raise PermissionError(f"Permission denied reading {self.filename}")

    def iter_timesteps(self, fields_of_interest: Tuple[str, ...] = ('id', 'x', 'y', 'z')) -> Iterator[Dict]:
        '''
        Iterate over all timesteps in the trajectory file and yield a dictionary
        for each timestep containing timestep number, box bounds, and atom data.

        Args:
            fields_of_interest (tuple of str): Column names to extract from the ATOMS section.
                                               Defaults to ('id', 'x', 'y', 'z').
                                               Can include 'type', 'vx', 'vy', 'vz', etc.

        Yields:
            dict: {
                'timestep': int,
                'box': dict with 'bounds' and optionally 'tilt_factors',
                'atom_data': dict mapping field names to lists of values
            }

        Raises:
            ValueError: If a required field in fields_of_interest is missing from the ATOMS header.
        '''
        with open(self.filename, 'r') as file:
            while True:
                line = file.readline()
                if not line:
                    break
                    
                if line.startswith('ITEM: TIMESTEP'):
                    try:
                        timestep = self._parse_timestep(file)
                        number_of_atoms = self._parse_number_of_atoms(file)
                        box_info = self._parse_box_bounds(file)
                        header, indices = self._parse_atoms_header(file, fields_of_interest)
                        atom_data = self._parse_atoms_data(file, number_of_atoms, indices, fields_of_interest)

                        yield {
                            'timestep': timestep,
                            'box': box_info,
                            'atom_data': atom_data
                        }
                    except Exception as e:
                        raise ValueError(f"Error parsing timestep at line: {line.strip()}") from e

    def _parse_timestep(self, file) -> int:
        '''
        Read the next line as the integer timestep number.

        Args:
            file (file object): File positioned immediately after 'ITEM: TIMESTEP'.

        Returns:
            int: Parsed timestep number.
        '''
        line = file.readline().strip()
        try:
            return int(line)
        except ValueError:
            raise ValueError(f"Could not parse timestep from line: '{line}'")

    def _parse_number_of_atoms(self, file) -> int:
        '''
        Verify 'ITEM: NUMBER OF ATOMS' header and parse the next line
        as the number of atoms in this timestep.

        Args:
            file (file object): File positioned at the 'ITEM: NUMBER OF ATOMS' line.

        Returns:
            int: Number of atoms.

        Raises:
            ValueError: If the expected header is missing.
        '''
        line = file.readline()
        if not line.startswith('ITEM: NUMBER OF ATOMS'):
            raise ValueError(f'Expected NUMBER OF ATOMS, got "{line.strip()}"')
        
        num_atoms_line = file.readline().strip()
        try:
            return int(num_atoms_line)
        except ValueError:
            raise ValueError(f"Could not parse number of atoms from line: '{num_atoms_line}'")

    def _parse_box_bounds(self, file) -> Dict:
        '''
        Parse box bounds, supporting both standard and triclinic formats.

        Args:
            file (file object): File positioned at the 'ITEM: BOX BOUNDS' line.

        Returns:
            dict: Contains 'bounds' (list of [lo, hi] for each dimension) and 
                  optionally 'tilt_factors' and 'boundary_conditions' for triclinic boxes.

        Raises:
            ValueError: If the expected header line is missing or parsing fails.
        '''
        box_line = file.readline()
        if not box_line.startswith('ITEM: BOX BOUNDS'):
            raise ValueError(f'Expected BOX BOUNDS, got "{box_line.strip()}"')
        
        box_info = {'bounds': []}
        
        # Check if this is a triclinic box (has xy xz yz parameters)
        if 'xy xz yz' in box_line:
            box_info['is_triclinic'] = True
            # Extract boundary conditions if present (pp pp pp, etc.)
            parts = box_line.strip().split()
            if len(parts) > 5:  # Has boundary conditions
                box_info['boundary_conditions'] = parts[5:]
        else:
            box_info['is_triclinic'] = False
        
        # Read the three box bound lines
        try:
            for i in range(3):
                line = file.readline().strip().split()
                if box_info['is_triclinic']:
                    # Format: xlo_bound xhi_bound tilt_factor
                    if len(line) < 3:
                        raise ValueError(f"Expected 3 values for triclinic box bounds, got {len(line)}")
                    lo, hi, tilt = map(float, line[:3])
                    box_info['bounds'].append([lo, hi])
                    if 'tilt_factors' not in box_info:
                        box_info['tilt_factors'] = []
                    box_info['tilt_factors'].append(tilt)
                else:
                    # Standard format: xlo xhi
                    if len(line) < 2:
                        raise ValueError(f"Expected 2 values for standard box bounds, got {len(line)}")
                    lo, hi = map(float, line[:2])
                    box_info['bounds'].append([lo, hi])
        except ValueError as e:
            raise ValueError(f"Error parsing box bounds: {e}")
        
        return box_info

    def _parse_atoms_header(self, file, fields_of_interest: Tuple[str, ...]) -> Tuple[List[str], Dict[str, int]]:
        '''
        Verify 'ITEM: ATOMS' header line and determine column indices
        for the requested fields.

        Args:
            file (file object): File positioned at the 'ITEM: ATOMS' line.
            fields_of_interest (tuple of str): Column names to locate.

        Returns:
            tuple:
                header (list of str): All column names in the ATOMS section.
                indices (dict): Mapping from each field_of_interest to its column index.

        Raises:
            ValueError: If the expected 'ITEM: ATOMS' header is missing or fields are not found.
        '''
        line = file.readline()
        if not line.startswith('ITEM: ATOMS'):
            raise ValueError(f'Expected ATOMS header, got "{line.strip()}"')
        
        header = line.strip().split()[2:]  # Remove 'ITEM:' and 'ATOMS'
        
        # Validate that all requested fields exist
        missing_fields = [key for key in fields_of_interest if key not in header]
        if missing_fields:
            raise ValueError(f'Fields {missing_fields} not found in header {header}')
        
        indices = {key: header.index(key) for key in fields_of_interest}
        return header, indices

    def _parse_atoms_data(self, file, number_of_atoms: int, indices: Dict[str, int], 
                         fields_of_interest: Tuple[str, ...]) -> Dict[str, List]:
        '''
        Read atom data and extract the specified columns.

        Args:
            file (file object): File positioned immediately after the 'ITEM: ATOMS' header line.
            number_of_atoms (int): Number of atom lines to read.
            indices (dict): Mapping of field names to column indices.
            fields_of_interest (tuple): Field names to extract.

        Returns:
            dict: Mapping from field names to lists of values.
        '''
        # Read all atom lines at once
        atom_lines = []
        for _ in range(number_of_atoms):
            line = file.readline()
            if not line.strip():
                raise ValueError(f"Unexpected end of file while reading atom data")
            atom_lines.append(line)
        
        lines = ''.join(atom_lines)
        
        try:
            arr = np.fromstring(lines, dtype=np.float64, sep=' ')
            expected_size = number_of_atoms * len(indices)
            
            # Check if we have the expected amount of data
            if arr.size == 0:
                raise ValueError("No atom data found")
            
            # Reshape based on actual columns in the file
            num_cols = arr.size // number_of_atoms
            if arr.size % number_of_atoms != 0:
                raise ValueError(f"Inconsistent number of columns in atom data")
            
            arr = arr.reshape((number_of_atoms, num_cols))
            
        except Exception as e:
            raise ValueError(f"Error parsing atom data: {e}")
        
        atom_data = {}
        for field in fields_of_interest:
            col_idx = indices[field]
            if col_idx >= num_cols:
                raise ValueError(f"Column index {col_idx} for field '{field}' exceeds available columns")
            
            if field in ('id', 'type'):
                # Integer fields
                atom_data[field] = arr[:, col_idx].astype(int).tolist()
            else:
                # Float fields (positions, velocities, etc.)
                atom_data[field] = arr[:, col_idx].tolist()
        
        return atom_data

    def get_timestep(self, target_timestep: int) -> Dict:
        '''
        Retrieve a single timestep's data by iterating until the matching
        timestep is found.

        Args:
            target_timestep (int): Timestep number to search for.

        Returns:
            dict: Complete timestep data for the matching timestep.

        Raises:
            ValueError: If the specified timestep is not present in the file.
        '''
        for data in self.iter_timesteps():
            if data['timestep'] == target_timestep:
                return data
        raise ValueError(f'Timestep {target_timestep} not found')

    def get_timestep_list(self) -> List[int]:
        '''
        Get a list of all available timesteps in the file.
        
        Returns:
            list: List of all timestep numbers in the file.
        '''
        timesteps = []
        for data in self.iter_timesteps(fields_of_interest=('id',)):  # Minimal read
            timesteps.append(data['timestep'])
        return timesteps

    # Convenience methods for backward compatibility
    def get_positions(self, timestep_data: Dict) -> List[List[float]]:
        '''
        Extract positions from timestep data in the original format.
        
        Args:
            timestep_data (dict): Data from iter_timesteps()
            
        Returns:
            list: List of [x, y, z] positions
        '''
        atom_data = timestep_data['atom_data']
        required_fields = ['x', 'y', 'z']
        missing_fields = [f for f in required_fields if f not in atom_data]
        if missing_fields:
            raise ValueError(f"Missing position fields: {missing_fields}")
        
        return [[atom_data['x'][i], atom_data['y'][i], atom_data['z'][i]] 
                for i in range(len(atom_data['x']))]
    
    def get_ids(self, timestep_data: Dict) -> List[int]:
        '''
        Extract atom IDs from timestep data.
        
        Args:
            timestep_data (dict): Data from iter_timesteps()
            
        Returns:
            list: List of atom IDs
        '''
        if 'id' not in timestep_data['atom_data']:
            raise ValueError("No 'id' field found in atom data")
        return timestep_data['atom_data']['id']

    def get_box_dimensions(self, timestep_data: Dict) -> Tuple[float, float, float]:
        '''
        Calculate box dimensions from box bounds.
        
        Args:
            timestep_data (dict): Data from iter_timesteps()
            
        Returns:
            tuple: (Lx, Ly, Lz) box dimensions
        '''
        bounds = timestep_data['box']['bounds']
        return tuple(hi - lo for lo, hi in bounds)

    def get_volume(self, timestep_data: Dict) -> float:
        '''
        Calculate box volume.
        
        Args:
            timestep_data (dict): Data from iter_timesteps()
            
        Returns:
            float: Box volume
        '''
        Lx, Ly, Lz = self.get_box_dimensions(timestep_data)
        return Lx * Ly * Lz

    def __repr__(self) -> str:
        return f"LammpstrjParser('{self.filename}')"