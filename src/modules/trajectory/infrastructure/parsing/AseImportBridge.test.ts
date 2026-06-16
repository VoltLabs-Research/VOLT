import assert from 'node:assert/strict';
import { describe, it, before, after } from 'node:test';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { parseAseMetadata } from '@/modules/trajectory/infrastructure/parsing/AseImportBridge';

const XYZ_CONTENT = `3
H2O molecule
O  0.0 0.0 0.0
H  0.9 0.0 0.0
H -0.9 0.0 0.0
`;

describe('AseImportBridge', () => {
    let tmpDir: string;
    let xyzPath: string;

    before(async () => {
        tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ase-bridge-test-'));
        xyzPath = path.join(tmpDir, 'test.xyz');
        await fs.writeFile(xyzPath, XYZ_CONTENT, 'utf8');
    });

    after(async () => {
        await fs.rm(tmpDir, { recursive: true, force: true });
    });

    it('parseAseMetadata returns correct atom count and cell', async () => {
        const meta = await parseAseMetadata(xyzPath);
        assert.equal(meta.natoms, 3);
        assert.ok(Array.isArray(meta.simulationCell.geometry.cell_vectors), 'cell_vectors present');
        assert.equal(meta.simulationCell.geometry.cell_vectors.length, 3, '3x3 cell');
        assert.ok(meta.headers.includes('x'), 'headers include x');
    });
});
