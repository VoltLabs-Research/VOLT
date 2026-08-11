/**
 * Valida la extraccion de documentos `payload` grandes sin materializarlos en JS.
 *
 * Construye parquets de una sola columna `payload` con las formas que admite el
 * contrato y comprueba que el listing, los sub-listings, el export y el parquet
 * per-atom salen bien. Para las secciones que ahora se aplanan a parquet (mesh y
 * atomistic) compara el GLB que produce el exportador por la ruta columnar contra el
 * que produce por la ruta en memoria: deben ser identicos byte a byte.
 *
 * El limite de tamano en si se prueba en `payload-limit-check.ts`, que si genera un
 * documento por encima del techo de V8.
 *
 * Ejecutar dentro del contenedor del daemon:
 *   npx tsx scripts/payload-reader-check.ts
 */
import { DuckDBConnection } from '@duckdb/node-api';
import assert from 'node:assert/strict';
import {
    isPayloadTooLargeForJs,
    measurePayloadBytes,
    readLargePayloadDocument
} from '@modules/analysis/services/workflow/payload-document-reader';
import { readWorkflowExposurePayload } from '@modules/analysis/services/workflow/exposure-payload-reader';
import { exportMeshArtifact } from '@modules/plugin/services/exports/mesh-exporter';
import { exportAtomisticArtifact } from '@modules/plugin/services/exports/atomistic-exporter';
import type { JsonObject } from '@shared/contracts/types/json';
import type { SubListingBatchSource } from '@shared/contracts/types/workflow-exposure';
import {
    buildExportInput,
    collectSubListingRows,
    writePayloadParquet
} from './payload-check-harness';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

/** DuckDB devuelve enteros como BigInt, que JSON.stringify no admite. */
const stringify = (value: unknown): string =>
    JSON.stringify(value, (_key, item) => (typeof item === 'bigint' ? Number(item) : item));

const buildPerAtomDocument = (perAtom: unknown): JsonObject => ({
    main_listing: {
        total_atoms: 3,
        coherent_region_count: 2
    },
    sub_listings: {
        regions: [
            {
                region_id: 0,
                size: 2
            },
            {
                region_id: 1,
                size: 1
            }
        ]
    },
    'export': { MeshExporter: { vertices: [] } },
    'per-atom-properties': perAtom
});

const readPerAtom = async (
    connection: DuckDBConnection,
    filePath: string
): Promise<Record<string, unknown>[]> => {
    const reader = await connection.runAndReadAll(
        `SELECT * FROM read_parquet('${filePath}') ORDER BY atom_index`
    );
    return reader.getRowObjectsJS();
};

const withTempDir = async <T>(label: string, run: (dir: string) => Promise<T>): Promise<T> => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), `${label}-`));
    try {
        return await run(dir);
    } finally {
        await fs.rm(dir, {
            recursive: true,
            force: true
        });
    }
};

const checkPerAtom = (label: string, perAtom: unknown): Promise<void> =>
    withTempDir('payload-check', async (dir) => {
        const parquet = path.join(dir, 'exposure.parquet');
        const connection = await DuckDBConnection.create();

        try {
            await writePayloadParquet(connection, JSON.stringify(buildPerAtomDocument(perAtom)), parquet);

            const bytes = await measurePayloadBytes(connection, parquet);
            const document = await readLargePayloadDocument(connection, parquet, dir);

            console.log(`\n[${label}]`);
            console.log(`  bytes=${bytes} superaria-el-limite=${isPayloadTooLargeForJs(bytes)}`);
            console.log(`  listing=${JSON.stringify(document.listing)}`);
            console.log(`  subListings=${JSON.stringify(await collectSubListingRows(document.subListingSources))}`);
            console.log(`  exportData=${JSON.stringify(document.exportData)}`);
            console.log(`  perAtomSource=${document.perAtomSource ? `${document.perAtomSource.rowCount} filas` : 'null'}`);

            assert.deepEqual(document.listing, {
                main_listing: {
                    total_atoms: 3,
                    coherent_region_count: 2
                }
            });
            assert.deepEqual(await collectSubListingRows(document.subListingSources), {
                regions: [
                    {
                        region_id: 0,
                        size: 2
                    },
                    {
                        region_id: 1,
                        size: 1
                    }
                ]
            });

            assert.ok(document.perAtomSource, 'se esperaba un parquet per-atom');
            assert.equal(document.perAtomSource.rowCount, 3);
            const rows = await readPerAtom(connection, document.perAtomSource.filePath);
            console.log(`  filas per-atom=${stringify(rows)}`);
            assert.equal(rows.length, 3);
            assert.equal(Number(rows[0].id), 10);
            assert.equal(Number(rows[2].region), 1);
        } finally {
            connection.closeSync();
        }
    });

/** Malla con indices desordenados, un indice repetido y un facet que apunta a la nada. */
const buildMeshDocument = (): JsonObject => ({
    main_listing: {
        total_nodes: 5,
        total_facets: 4
    },
    sub_listings: {
        points: [
            {
                index: 7,
                position: [0, 0, 0]
            },
            {
                index: 3,
                position: [1, 0, 0]
            }
        ]
    },
    'export': {
        MeshExporter: {
            vertices: [
                {
                    index: 7,
                    position: [0, 0, 0]
                },
                {
                    index: 3,
                    position: [1, 0, 0]
                },
                {
                    index: 11,
                    position: [0, 1, 0]
                },
                {
                    index: 4,
                    position: [0, 0, 1]
                },
                /* Indice repetido: el ultimo gana, igual que un Map. */
                {
                    index: 7,
                    position: [2, 2, 2]
                }
            ],
            facets: [
                { vertices: [7, 3, 11] },
                { vertices: [3, 11, 4] },
                /* 99 no existe: el facet se descarta. */
                { vertices: [7, 99, 4] },
                { vertices: [4, 7, 3] }
            ]
        }
    }
});

/** Dos buckets, colores explicitos solo en uno, para ejercitar la precedencia. */
const buildAtomisticDocument = (): JsonObject => ({
    main_listing: { total_atoms: 5 },
    'export': {
        AtomisticExporter: {
            'Cluster 2': [
                {
                    id: 1,
                    pos: [0, 0, 0],
                    color: [1, 0, 0]
                },
                {
                    id: 2,
                    pos: [1, 1, 1],
                    structure_color: [0, 1, 0]
                }
            ],
            'Cluster 1': [
                {
                    id: 3,
                    pos: [2, 0, 0]
                },
                {
                    id: 4,
                    pos: [0, 2, 0],
                    rgb: [255, 128, 0]
                },
                {
                    id: 5,
                    pos: [0, 0, 2],
                    base_color: [0, 0, 1, 1]
                }
            ]
        }
    }
});

type Exporter = 'MeshExporter' | 'AtomisticExporter';

const runExporter = async (
    exporter: Exporter,
    exportData: JsonObject,
    outputDirectory: string
): Promise<Buffer> => {
    const { input, staged } = buildExportInput(exporter, outputDirectory);
    if (exporter === 'MeshExporter') {
        await exportMeshArtifact(input, exportData as never, 'mesh.glb', 'cluster-1', {});
    } else {
        await exportAtomisticArtifact(input, exportData as never, 'atoms.glb', 'cluster-1');
    }
    assert.equal(staged.length, 1, `${exporter} no produjo exactamente un artefacto`);
    return staged[0];
};

/**
 * El mismo documento por las dos rutas: inline (documento chico) y columnar
 * (`readLargePayloadDocument`). El GLB tiene que salir igual.
 */
const checkExporterEquivalence = (
    label: string,
    exporter: Exporter,
    document: JsonObject
): Promise<void> =>
    withTempDir('payload-equiv', async (dir) => {
        const parquet = path.join(dir, 'exposure.parquet');
        const connection = await DuckDBConnection.create();

        let columnarExport: JsonObject | null;
        let subListings: SubListingBatchSource[];
        try {
            await writePayloadParquet(connection, JSON.stringify(document), parquet);
            const columnar = await readLargePayloadDocument(connection, parquet, dir);
            columnarExport = columnar.exportData;
            subListings = columnar.subListingSources;
        } finally {
            connection.closeSync();
        }

        assert.ok(columnarExport, 'la ruta columnar no devolvio export');
        const columnarSection = (columnarExport.export as JsonObject)[exporter] as JsonObject;
        assert.ok(
            '__parquet_source__' in columnarSection,
            `${exporter} deberia venir como referencia a parquet, no inline`
        );

        const inlineSection = (document.export as JsonObject)[exporter] as JsonObject;
        const inlineGlb = await runExporter(exporter, inlineSection, path.join(dir, 'inline'));
        const columnarGlb = await runExporter(exporter, columnarSection, path.join(dir, 'columnar'));

        console.log(`\n[${label}]`);
        console.log(`  glb inline=${inlineGlb.byteLength}B columnar=${columnarGlb.byteLength}B`);
        assert.ok(inlineGlb.byteLength > 0, 'el GLB inline salio vacio');
        assert.equal(
            columnarGlb.equals(inlineGlb),
            true,
            'el GLB de la ruta columnar difiere del de la ruta inline'
        );

        /* Los sub-listings del documento tienen que sobrevivir el viaje intactos. */
        const originalSubListings = (document.sub_listings ?? {}) as Record<string, JsonObject[]>;
        assert.deepEqual(await collectSubListingRows(subListings), originalSubListings);
        console.log('  sub-listings identicos y GLB identico');
    });

/** El camino completo: parquet -> readWorkflowExposurePayload, como en produccion. */
const checkFullReadPath = (): Promise<void> =>
    withTempDir('payload-full', async (dir) => {
        const parquet = path.join(dir, 'defect_mesh.parquet');
        const connection = await DuckDBConnection.create();
        try {
            await writePayloadParquet(connection, JSON.stringify(buildMeshDocument()), parquet);
        } finally {
            connection.closeSync();
        }

        const result = await readWorkflowExposurePayload(parquet);
        console.log('\n[readWorkflowExposurePayload documento chico]');
        console.log(`  listing=${JSON.stringify(result.listing)}`);
        console.log(`  subListingNames=${JSON.stringify(result.subListingNames)}`);
        assert.deepEqual(result.subListingNames, ['points']);
        assert.deepEqual(await collectSubListingRows(result.subListings), {
            points: [
                {
                    index: 7,
                    position: [0, 0, 0]
                },
                {
                    index: 3,
                    position: [1, 0, 0]
                }
            ]
        });
        assert.ok(result.exportData, 'se esperaba export data');
        console.log('  ok');
    });

const main = async (): Promise<void> => {
    await checkPerAtom('array de objetos', [
        {
            id: 10,
            region: 0,
            rmsd: 0.11
        },
        {
            id: 11,
            region: 0,
            rmsd: 0.12
        },
        {
            id: 12,
            region: 1,
            rmsd: 0.13
        }
    ]);

    await checkPerAtom('objeto de arrays', {
        id: [10, 11, 12],
        region: [0, 0, 1],
        rmsd: [0.11, 0.12, 0.13]
    });

    await checkExporterEquivalence('mesh inline vs columnar', 'MeshExporter', buildMeshDocument());
    await checkExporterEquivalence('atomistic inline vs columnar', 'AtomisticExporter', buildAtomisticDocument());
    await checkFullReadPath();

    console.log('\nTodo OK');
};

void main().then(() => process.exit(0));
