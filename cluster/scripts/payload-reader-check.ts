/**
 * Valida la extraccion de documentos `payload` grandes sin materializarlos en JS.
 *
 * Construye un parquet de una sola columna `payload` en las dos formas que admite el
 * contrato (array de objetos por atomo y objeto de arrays por propiedad), y comprueba
 * que el listing, los sub-listings, el export y el parquet per-atom salen bien.
 *
 * Ejecutar dentro del contenedor del daemon:
 *   npx tsx scripts/payload-reader-check.ts
 */
import { DuckDBConnection } from '@duckdb/node-api';
import {
    isPayloadTooLargeForJs,
    measurePayloadBytes,
    readLargePayloadDocument
} from '@modules/analysis/services/workflow/payload-document-reader';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

/** DuckDB devuelve enteros como BigInt, que JSON.stringify no admite. */
const stringify = (value: unknown): string =>
    JSON.stringify(value, (_key, item) => (typeof item === 'bigint' ? Number(item) : item));

const buildDocument = (perAtom: unknown): string => JSON.stringify({
    main_listing: {
        total_atoms: 3,
        coherent_region_count: 2
    },
    sub_listings: {
        regions: [
            {
 region_id: 0, size: 2 
},
            {
 region_id: 1, size: 1 
}
        ]
    },
    'export': { MeshExporter: { vertices: [] } },
    'per-atom-properties': perAtom
});

const writePayloadParquet = async (
    connection: DuckDBConnection,
    document: string,
    target: string
): Promise<void> => {
    const escaped = document.replace(/'/g, "''");
    await connection.run(
        `COPY (SELECT '${escaped}' AS payload) TO '${target}' (FORMAT PARQUET)`
    );
};

const readPerAtom = async (
    connection: DuckDBConnection,
    filePath: string
): Promise<Record<string, unknown>[]> => {
    const reader = await connection.runAndReadAll(
        `SELECT * FROM read_parquet('${filePath}') ORDER BY atom_index`
    );
    return reader.getRowObjectsJS();
};

const check = async (label: string, perAtom: unknown): Promise<void> => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'payload-check-'));
    const parquet = path.join(dir, 'exposure.parquet');
    const connection = await DuckDBConnection.create();

    try {
        await writePayloadParquet(connection, buildDocument(perAtom), parquet);

        const bytes = await measurePayloadBytes(connection, parquet);
        const document = await readLargePayloadDocument(connection, parquet, dir);

        console.log(`\n[${label}]`);
        console.log(`  bytes=${bytes} superaria-el-limite=${isPayloadTooLargeForJs(bytes)}`);
        console.log(`  listing=${JSON.stringify(document.listing)}`);
        console.log(`  subListings=${JSON.stringify(document.subListings)}`);
        console.log(`  exportData=${JSON.stringify(document.exportData)}`);
        console.log(`  perAtomSource=${document.perAtomSource ? `${document.perAtomSource.rowCount} filas` : 'null'}`);
        if (document.perAtomSource) {
            console.log(`  filas per-atom=${stringify(await readPerAtom(connection, document.perAtomSource.filePath))}`);
        }
    } finally {
        connection.closeSync();
        await fs.rm(dir, {
            recursive: true,
            force: true
        });
    }
};

const main = async (): Promise<void> => {
    await check('array de objetos', [
        {
 id: 10, region: 0, rmsd: 0.11 
},
        {
 id: 11, region: 0, rmsd: 0.12 
},
        {
 id: 12, region: 1, rmsd: 0.13 
}
    ]);

    await check('objeto de arrays', {
        id: [10, 11, 12],
        region: [0, 0, 1],
        rmsd: [0.11, 0.12, 0.13]
    });
};

void main().then(() => process.exit(0));
