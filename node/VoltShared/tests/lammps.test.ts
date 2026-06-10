import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
    detectLammpsMetadataFormat,
    parseLammpsMetadata
} from '../src/lammps';

const DUMP_HEADER = [
    'ITEM: TIMESTEP',
    '5000',
    'ITEM: NUMBER OF ATOMS',
    '2',
    'ITEM: BOX BOUNDS pp pp pp',
    '0.0 10.0',
    '0.0 20.0',
    '0.0 30.0',
    'ITEM: ATOMS id type x y z'
];

const DATA_HEADER = [
    'LAMMPS data file via write_data, timestep = 1275',
    '',
    '4 atoms',
    '',
    '0.0 10.0 xlo xhi',
    '0.0 20.0 ylo yhi',
    '0.0 30.0 zlo zhi'
];

describe('lammps metadata parsing', () => {
    it('detects dump vs data formats', () => {
        assert.equal(detectLammpsMetadataFormat(DUMP_HEADER), 'dump');
        assert.equal(detectLammpsMetadataFormat(DATA_HEADER), 'data');
        assert.equal(detectLammpsMetadataFormat(['nonsense']), null);
    });

    it('parses an orthogonal dump header', () => {
        const meta = parseLammpsMetadata(DUMP_HEADER);
        assert.equal(meta.timestep, 5000);
        assert.equal(meta.natoms, 2);
        assert.deepEqual(meta.headers, ['id', 'type', 'x', 'y', 'z']);
        assert.deepEqual(meta.simulationCell.geometry.periodic_boundary_conditions, { x: true, y: true, z: true });
        assert.deepEqual(meta.simulationCell.geometry.cell_vectors, [
            [10, 0, 0],
            [0, 20, 0],
            [0, 0, 30]
        ]);
        assert.equal(meta.simulationCell.boundingBox.width, 10);
        assert.equal(meta.simulationCell.boundingBox.length, 20);
        assert.equal(meta.simulationCell.boundingBox.height, 30);
    });

    it('parses a data header with bounds', () => {
        const meta = parseLammpsMetadata(DATA_HEADER);
        assert.equal(meta.timestep, 1275);
        assert.equal(meta.natoms, 4);
        assert.equal(meta.simulationCell.boundingBox.width, 10);
    });

    it('throws on an unsupported format', () => {
        assert.throws(() => parseLammpsMetadata(['garbage line']), /Unsupported trajectory format/);
    });
});
