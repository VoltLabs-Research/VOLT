import assert from 'node:assert/strict';
import { describe, it, before, after } from 'node:test';
import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const ASE_PYTHON = process.env['ASE_PYTHON'] ??
    path.join(__dirname, '../../../../../../../.venv-pyatomsk/bin/python');
const BRIDGE_SCRIPT = path.join(__dirname, '../../../../modules/trajectory/infrastructure/parsing/ase_export_bridge.py');

/** Create a minimal per-atom Parquet with 8 atoms (FCC-like positions) + a cluster_id column. */
const createTestParquet = async (parquetPath: string): Promise<void> => {
    const script = `
import pyarrow as pa, pyarrow.parquet as pq, numpy as np, sys
n = 8
a = 3.6
xs = [0,a/2,a/2,0, 0,a/2,a/2,0]
ys = [0,0,  a/2,a/2, 0,0,  a/2,a/2]
zs = [0,0,  0,  0,   a,a,  a,  a  ]
cluster_id = [0,0,0,0,1,1,1,1]
table = pa.table({
    'atom_index': pa.array(range(n), type=pa.uint32()),
    'id': pa.array(range(1, n+1), type=pa.uint64()),
    'x': pa.array(xs, type=pa.float64()),
    'y': pa.array(ys, type=pa.float64()),
    'z': pa.array(zs, type=pa.float64()),
    'bucket': pa.array(['FCC']*n, type=pa.utf8()),
    'structure_id': pa.array([1]*n, type=pa.int32()),
    'structure_name': pa.array(['FCC']*n, type=pa.utf8()),
    'cluster_id': pa.array(cluster_id, type=pa.int64()),
    'element_symbol': pa.array(['Cu']*n, type=pa.utf8()),
    'type_id': pa.array([1]*n, type=pa.int32()),
})
pq.write_table(table, sys.argv[1])
`;
    await new Promise<void>((resolve, reject) => {
        const proc = spawn(ASE_PYTHON, ['-c', script, parquetPath], { stdio: ['ignore', 'ignore', 'pipe'] });
        const errs: Buffer[] = [];
        proc.stderr?.on('data', (c: Buffer) => errs.push(c));
        proc.on('error', reject);
        proc.on('close', (code) => {
            code === 0 ? resolve() : reject(new Error(`create parquet failed: ${Buffer.concat(errs)}`));
        });
    });
};

const runBridge = (parquetPath: string, outputPath: string, format: string, colMapping: Record<string, string>): Promise<void> =>
    new Promise((resolve, reject) => {
        const proc = spawn(ASE_PYTHON, [
            BRIDGE_SCRIPT, parquetPath, outputPath, format, JSON.stringify(colMapping)
        ], { stdio: ['ignore', 'ignore', 'pipe'] });
        const errs: Buffer[] = [];
        proc.stderr?.on('data', (c: Buffer) => errs.push(c));
        proc.on('error', reject);
        proc.on('close', (code) => {
            code === 0 ? resolve() : reject(new Error(`bridge failed: ${Buffer.concat(errs)}`));
        });
    });

describe('configuration-exporter round-trip', () => {
    let tmpDir: string;
    let parquetPath: string;

    before(async () => {
        tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'volt-cfg-test-'));
        parquetPath = path.join(tmpDir, 'atoms.parquet');
        await createTestParquet(parquetPath);
    });

    after(async () => {
        await fs.rm(tmpDir, { recursive: true, force: true });
    });

    it('exports 8-atom parquet to extXYZ and reads back correct atom count', async () => {
        const outputPath = path.join(tmpDir, 'out.xyz');
        await runBridge(parquetPath, outputPath, 'extxyz', { x: 'x', y: 'y', z: 'z' });

        const content = await fs.readFile(outputPath, 'utf-8');
        const lines = content.trim().split('\n');
        assert.equal(Number(lines[0].trim()), 8, 'atom count in extXYZ should be 8');
    });

    it('exports with custom:cluster_id column and verifies it appears in extXYZ properties', async () => {
        const outputPath = path.join(tmpDir, 'out_cid.xyz');
        await runBridge(parquetPath, outputPath, 'extxyz', {
            x: 'x', y: 'y', z: 'z',
            'custom:cluster_id': 'cluster_id'
        });

        const content = await fs.readFile(outputPath, 'utf-8');
        assert.ok(content.includes('cluster_id'), 'cluster_id column should appear in extXYZ output');
    });

    it('exports to POSCAR format without crashing', async () => {
        const outputPath = path.join(tmpDir, 'POSCAR');
        await runBridge(parquetPath, outputPath, 'poscar', { x: 'x', y: 'y', z: 'z', symbol: 'element_symbol' });
        const stat = await fs.stat(outputPath);
        assert.ok(stat.size > 0, 'POSCAR output should be non-empty');
    });

    it('exports to LAMMPS dump format without crashing', async () => {
        const outputPath = path.join(tmpDir, 'out.dump');
        await runBridge(parquetPath, outputPath, 'lammps-dump', { x: 'x', y: 'y', z: 'z' });
        const content = await fs.readFile(outputPath, 'utf-8');
        assert.ok(content.includes('ITEM: ATOMS'), 'LAMMPS dump should contain ITEM: ATOMS header');
    });
});
