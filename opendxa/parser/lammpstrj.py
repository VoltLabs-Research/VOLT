import numpy as np
import itertools

class LammpstrjParser:
    '''
    Parser for LAMMPS .lammpstrj trajectory files. Iterates over timesteps
    and extracts atom IDs and positions for each frame.
    '''
    def __init__(self, filename):
        '''
        Initialize the parser with the path to the trajectory file.

        Args:
            filename (str): Path to the LAMMPS .lammpstrj file to parse.
        '''
        self.filename = filename

    def iter_timesteps(self, fields_of_interest=('id', 'x', 'y', 'z')):
        '''
        Iterate over all timesteps in the trajectory file and yield a dictionary
        for each timestep containing timestep number, box bounds, atom IDs,
        and atom positions.

        Args:
            fields_of_interest (tuple of str): Column names to extract from the ATOMS section.
                                               Defaults to ('id', 'x', 'y', 'z').

        Yields:
            dict: {
                'timestep': int,
                'box': list of [lo, hi] for each of the 3 dimensions,
                'ids': list of int atom IDs,
                'positions': list of [x, y, z] floats for each atom
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
                    timestep = self._parse_timestep(file)
                    number_of_atoms = self._parse_number_of_atoms(file)
                    box = self._parse_box_bounds(file)
                    header, indices = self._parse_atoms_header(file, fields_of_interest)
                    ids, positions = self._parse_atoms_data(file, number_of_atoms, indices)

                    yield {
                        'timestep': timestep,
                        'box': box,
                        'ids': ids,
                        'positions': positions
                    }

    def _parse_timestep(self, file):
        '''
        Read the next line as the integer timestep number.

        Args:
            file (file object): File positioned immediately after 'ITEM: TIMESTEP'.

        Returns:
            int: Parsed timestep number.
        '''
        return int(file.readline().strip())

    def _parse_number_of_atoms(self, file):
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
        return int(file.readline().strip())

    def _parse_box_bounds(self, file):
        '''
        Verify 'ITEM: BOX BOUNDS' header and read three lines of box bounds.

        Args:
            file (file object): File positioned at the 'ITEM: BOX BOUNDS' line.

        Returns:
            list of [float, float]: Three [lo, hi] bounds for each dimension.

        Raises:
            AssertionError: If the expected header line is missing.
        '''
        assert file.readline().startswith('ITEM: BOX BOUNDS')
        box = []
        for _ in range(3):
            lo, hi = map(float, file.readline().strip().split())
            box.append([lo, hi])
        return box

    def _parse_atoms_header(self, file, fields_of_interest):
        '''
        Verify 'ITEM: ATOMS' header line and determine column indices
        for the requested fields.

        Args:
            file (file object): File positioned at the 'ITEM: ATOMS' line.
            fields_of_interest (tuple of str): Column names to locate (e.g., 'id', 'x', 'y', 'z').

        Returns:
            tuple:
                header (list of str): All column names in the ATOMS section.
                indices (dict): Mapping from each field_of_interest to its column index.

        Raises:
            AssertionError: If the expected 'ITEM: ATOMS' header is missing.
            ValueError: If any field_of_interest is not found in the header.
        '''
        line = file.readline()
        assert line.startswith('ITEM: ATOMS')
        header = line.strip().split()[2:]
        for key in fields_of_interest:
            if key not in header:
                raise ValueError(f'{key} not foun in {header}')
        indices = {key: header.index(key) for key in fields_of_interest}
        return header, indices

    def get_timestep(self, target_timestep):
        '''
        Retrieve a single timestep's data by iterating until the matching
        timestep is found.

        Args:
            target_timestep (int): Timestep number to search for.

        Returns:
            dict: {'timestep', 'box', 'ids', 'positions'} for the matching timestep.

        Raises:
            ValueError: If the specified timestep is not present in the file.
        '''
        for data in self.iter_timesteps():
            if data['timestep'] == target_timestep:
                return data
        raise ValueError(f'Timestep {target_timestep} not found')

    def _parse_atoms_data(self, file, number_of_atoms, indices):
        '''
        Read the next 'number_of_atoms' lines of atom data and extract
        the specified columns for IDs and positions.

        Args:
            file (file object): File positioned immediately after the 'ITEM: ATOMS' header line.
            number_of_atoms (int): Number of atom lines to read.
            indices (dict): Mapping of field names ('id','x','y','z') to column indices.

        Returns:
            tuple:
                ids (list of int): Parsed atom IDs.
                positions (list of [float, float, float]): Parsed [x, y, z] positions.

        Raises:
            ValueError: If loadtxt fails to read the expected number of rows.
        '''
        lines = ''.join(itertools.islice(file, number_of_atoms))
        arr = np.fromstring(lines, dtype=np.float64, sep=' ')
        num_cols = len(indices)
        arr = arr.reshape((number_of_atoms, -1))
        ids = arr[:, indices['id']].astype(int).tolist()
        positions = arr[:, [indices[ax] for ax in ('x','y','z')]].tolist()
        return ids, positions
        