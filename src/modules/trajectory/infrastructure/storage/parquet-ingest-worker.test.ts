import assert from 'node:assert/strict';
import { describe, it, before, after } from 'node:test';
import { Worker } from 'node:worker_threads';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { DuckDBConnection, DuckDBTypeId } from '@duckdb/node-api';

const WORKER_PATH = path.join(__dirname, 'parquet-ingest-worker.cjs');

const DUMP_FIXTURE = `ITEM: TIMESTEP
1000
ITEM: NUMBER OF ATOMS
4
ITEM: BOX BOUNDS pp pp pp
0.0 10.0
0.0 10.0
0.0 10.0
ITEM: ATOMS id type x y z mol q structuretype
1 1 0.1 0.2 0.3 1000003 0.5 2
2 1 1.1 1.2 1.3 1000003 -0.5 2
3 2 2.1 2.2 2.3 7 1.25 0
4 2 3.1 3.2 3.3 7 1.25 1
`;

const DATA_FIXTURE = `# LAMMPS data file
4 atoms
2 atom types
0.0 10.0 xlo xhi
0.0 10.0 ylo yhi
0.0 10.0 zlo zhi

Masses

1 55.845   # Fe
2 12.011   # C

Atoms

1 1 0.1 0.2 0.3
2 1 1.1 1.2 1.3
3 2 2.1 2.2 2.3
4 2 3.1 3.2 3.3
`;

interface WorkerResult {
    columnDtypes: Record<string, 'i32' | 'f32'>;
    units: string;
    elementTable: Array<{ type: number; symbol: string; mass: number }>;
}

const runWorker = (workerData: unknown): Promise<WorkerResult> =>
    new Promise((resolve, reject) => {
        const worker = new Worker(WORKER_PATH, { workerData });
        worker.once('message', (message: { ok: boolean; result?: WorkerResult; error?: { message?: string } }) => {
            if (message.ok && message.result) resolve(message.result);
            else reject(new Error(message.error?.message ?? 'worker failed'));
        });
        worker.once('error', reject);
        worker.once('exit', (code) => {
            if (code !== 0) reject(new Error(`worker exited ${code}`));
        });
    });

describe('parquet ingest worker — typed columns + element table (schema v2)', () => {
    let tempDir: string;
    let dumpPath: string;
    let outputPath: string;

    before(async () => {
        tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'parquet-typed-'));
        dumpPath = path.join(tempDir, 'timestep-1000.dump');
        outputPath = path.join(tempDir, 'out.parquet');
        await fs.writeFile(dumpPath, DUMP_FIXTURE, 'utf8');
    });

    after(async () => {
        await fs.rm(tempDir, { recursive: true, force: true });
    });

    it('infers i32 for categorical/molecule columns and f32 for continuous, writing typed parquet', async () => {
        const result = await runWorker({
            outputPath,
            frames: [{ timestep: 1000, dumpPath }],
            customProperties: ['mol', 'q', 'structuretype']
        });

        assert.equal(result.columnDtypes.mol, 'i32');
        assert.equal(result.columnDtypes.structuretype, 'i32');
        assert.equal(result.columnDtypes.q, 'f32');
        assert.equal(result.units, 'metal');

        const connection = await DuckDBConnection.create();
        try {
            const reader = await connection.runAndReadAll(
                `SELECT * FROM read_parquet('${outputPath.replace(/'/g, "''")}') ORDER BY atom_index`
            );
            const typeIdByName = new Map<string, DuckDBTypeId>();
            for (let index = 0; index < reader.columnCount; index++) {
                typeIdByName.set(reader.columnName(index), reader.columnTypeId(index));
            }
            assert.equal(typeIdByName.get('mol'), DuckDBTypeId.INTEGER);
            assert.equal(typeIdByName.get('structuretype'), DuckDBTypeId.INTEGER);
            assert.equal(typeIdByName.get('q'), DuckDBTypeId.FLOAT);

            const rows = reader.getRowObjectsJS();
            assert.equal(Number(rows[0].mol), 1000003);
            assert.equal(Number(rows[2].mol), 7);
            assert.deepEqual(rows.map((r) => Number(r.structuretype)), [2, 2, 0, 1]);
        } finally {
            connection.closeSync();
        }
    });

    it('derives a per-type element table + units from a .data Masses section', async () => {
        const dataPath = path.join(tempDir, 'frame.data');
        const dataOutput = path.join(tempDir, 'data-out.parquet');
        await fs.writeFile(dataPath, DATA_FIXTURE, 'utf8');

        const result = await runWorker({
            outputPath: dataOutput,
            frames: [{ timestep: 0, dumpPath: dataPath }],
            customProperties: []
        });

        assert.equal(result.elementTable.length, 2);
        assert.equal(result.elementTable[0].type, 1);
        assert.equal(result.elementTable[0].symbol, 'Fe');
        assert.ok(Math.abs(result.elementTable[0].mass - 55.845) < 0.01);
        assert.equal(result.elementTable[1].symbol, 'C');
    });
});
