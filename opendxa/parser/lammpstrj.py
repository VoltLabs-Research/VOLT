import numpy as np
import itertools

class LammpstrjParser:
    def __init__(self, filename):
        self.filename = filename

    def iter_timesteps(self, fields_of_interest=('id', 'x', 'y', 'z')):
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
        return int(file.readline().strip())

    def _parse_number_of_atoms(self, file):
        assert file.readline().startswith('ITEM: NUMBER OF ATOMS')
        return int(file.readline().strip())

    def _parse_box_bounds(self, file):
        assert file.readline().startswith('ITEM: BOX BOUNDS')
        box = []
        for _ in range(3):
            lo, hi = map(float, file.readline().strip().split())
            box.append([lo, hi])
        return box

    def _parse_atoms_header(self, file, fields_of_interest):
        line = file.readline()
        assert line.startswith('ITEM: ATOMS')
        header = line.strip().split()[2:]
        for key in fields_of_interest:
            if key not in header:
                raise ValueError(f'{key} not foun in {header}')
        indices = {key: header.index(key) for key in fields_of_interest}
        return header, indices

    def get_timestep(self, target_timestep):
        for data in self.iter_timesteps():
            if data['timestep'] == target_timestep:
                return data
        raise ValueError(f'Timestep {target_timestep} not found')

    def _parse_atoms_data(self, file, number_of_atoms, indices):
        lines = ''.join(itertools.islice(file, number_of_atoms))
        arr = np.fromstring(lines, dtype=np.float64, sep=' ')
        num_cols = len(indices)
        arr = arr.reshape((number_of_atoms, -1))
        ids = arr[:, indices['id']].astype(int).tolist()
        positions = arr[:, [indices[ax] for ax in ('x','y','z')]].tolist()
        return ids, positions
        