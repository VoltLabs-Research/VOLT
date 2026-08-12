import { DuckDBConnection } from '@duckdb/node-api';
import assert from 'node:assert/strict';
import { readWorkflowExposurePayload } from '@modules/analysis/services/workflow/exposure-payload-reader';
import { measurePayloadBytes } from '@modules/analysis/services/workflow/payload-document-reader';
import { exportMeshArtifact } from '@modules/plugin/services/exports/mesh-exporter';
import { exportAtomisticArtifact } from '@modules/plugin/services/exports/atomistic-exporter';
import type { JsonObject } from '@shared/contracts/types/json';
import { buildExportInput } from './payload-check-harness';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const V8_MAX_STRING_LENGTH = 0x1fffffe8;

const VERTEX_BLOCK = 100_000;
const VERTEX_BLOCKS = 68;
const MESH_VERTICES = VERTEX_BLOCK * VERTEX_BLOCKS;
const FACET_BLOCK = 100_000;
const FACET_BLOCKS = 20;
const MESH_FACETS = FACET_BLOCK * FACET_BLOCKS;

const ATOM_BLOCK = 100_000;
const ATOM_BLOCKS = 25;
const ATOMS_PER_BUCKET = ATOM_BLOCK * ATOM_BLOCKS;
const ATOM_BUCKETS = 3;

const SUB_LISTING_ROWS = 1_000_000;

const megabytes = (bytes: number): string => `${(bytes / 1024 / 1024).toFixed(1)} MiB`;

const heapUsedMb = (): string => `${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(0)} MB`;

const jsonBlock = (element: string, count: number): string =>
    `(SELECT string_agg(${element}, ',' ORDER BY i) FROM range(0, ${count}) t(i))`;

const repeatedBlock = (element: string, count: number, blocks: number): string =>
    `rtrim(repeat(${jsonBlock(element, count)} || ',', ${blocks}), ',')`;

const VERTEX_ELEMENT =
    `'{"index":' || i || ',"position":[' `
    + `|| ((i % 1009) * 0.5019287109375) || ',' `
    + `|| ((i % 997) * 0.2509765625) || ',' `
    + `|| ((i % 991) * 0.12548828125) || ']}'`;

const FACET_ELEMENT =
    `'{"vertices":[' || (i % ${VERTEX_BLOCK}) || ',' `
    + `|| ((i * 7 + 1) % ${VERTEX_BLOCK}) || ',' `
    + `|| ((i * 13 + 2) % ${VERTEX_BLOCK}) || ']}'`;

const ATOM_ELEMENT =
    `'{"id":' || i || ',"pos":[' `
    + `|| ((i % 1009) * 0.5019287109375) || ',' `
    + `|| ((i % 997) * 0.2509765625) || ',' `
    + `|| ((i % 991) * 0.12548828125) || '],"color":[0.5,0.25,0.125]}'`;

const SUB_LISTING_ELEMENT =
    `'{"row_id":' || i || ',"label":"segment-' || i || '","note":"' || repeat('x', 500) || '"}'`;

const writeDocument = async (
    connection: DuckDBConnection,
    documentSql: string,
    target: string
): Promise<void> => {
    await connection.run(`COPY (${documentSql}) TO '${target}' (FORMAT PARQUET)`);
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

const sectionBytes = async (
    connection: DuckDBConnection,
    filePath: string,
    jsonPath: string
): Promise<number> => {
    const reader = await connection.runAndReadAll(
        `SELECT strlen(CAST(json_extract(payload, '${jsonPath}') AS VARCHAR)) AS bytes `
        + `FROM (SELECT payload FROM read_parquet('${filePath}') LIMIT 1)`
    );
    return Number(reader.getRowObjectsJS()[0]?.bytes ?? 0);
};

const checkOversizedMesh = (): Promise<void> =>
    withTempDir('limit-mesh', async (dir) => {
        const parquet = path.join(dir, 'defect_mesh.parquet');
        const connection = await DuckDBConnection.create();

        try {
            console.log('\n[mesh por encima del techo de V8]');
            console.log(`  armando documento (${MESH_VERTICES} vertices, ${MESH_FACETS} facets)...`);
            await writeDocument(
                connection,
                `SELECT '{"main_listing":{"total_nodes":${MESH_VERTICES},`
                + `"total_facets":${MESH_FACETS}},"sub_listings":{"facet_summary":`
                + `[{"kind":"boundary","count":${MESH_FACETS}}]},"export":{"MeshExporter":{"vertices":[' || `
                + `${repeatedBlock(VERTEX_ELEMENT, VERTEX_BLOCK, VERTEX_BLOCKS)} || '],"facets":[' || `
                + `${repeatedBlock(FACET_ELEMENT, FACET_BLOCK, FACET_BLOCKS)} || ']}}}' AS payload`,
                parquet
            );

            const documentBytes = await measurePayloadBytes(connection, parquet);
            const exportBytes = await sectionBytes(connection, parquet, '$.export.MeshExporter');
            console.log(`  documento=${megabytes(documentBytes)} seccion export=${megabytes(exportBytes)}`);
            assert.ok(
                exportBytes > V8_MAX_STRING_LENGTH,
                `la seccion export mide ${exportBytes}B, no supera el techo de ${V8_MAX_STRING_LENGTH}B: `
                + 'el escenario no prueba nada'
            );
        } finally {
            connection.closeSync();
        }

        console.log('  leyendo con readWorkflowExposurePayload...');
        const result = await readWorkflowExposurePayload(parquet);
        assert.deepEqual(result.listing, {
            main_listing: {
                total_nodes: MESH_VERTICES,
                total_facets: MESH_FACETS
            }
        });
        assert.deepEqual(result.subListingNames, ['facet_summary']);
        assert.ok(result.exportData, 'no llego export data');

        const section = (result.exportData.export as JsonObject).MeshExporter as JsonObject;
        assert.ok('__parquet_source__' in section, 'el mesh deberia venir como referencia a parquet');

        console.log(`  generando GLB... (heap ${heapUsedMb()})`);
        const { input, staged } = buildExportInput('MeshExporter', dir);
        await exportMeshArtifact(input, section as never, 'mesh.glb', 'cluster-1', {});
        assert.equal(staged.length, 1, 'el exportador no produjo un GLB');
        console.log(`  glb=${megabytes(staged[0].byteLength)} (heap ${heapUsedMb()})`);
        assert.ok(staged[0].byteLength > 100 * 1024 * 1024, 'el GLB salio sospechosamente chico');
    });

const checkOversizedAtomistic = (): Promise<void> =>
    withTempDir('limit-atoms', async (dir) => {
        const parquet = path.join(dir, 'coherent_crystalline_regions.parquet');
        const connection = await DuckDBConnection.create();
        const totalAtoms = ATOMS_PER_BUCKET * ATOM_BUCKETS;

        try {
            console.log('\n[atomistic por encima del techo de V8]');
            console.log(`  armando documento (${ATOM_BUCKETS} buckets, ${totalAtoms} atomos)...`);
            const buckets = Array.from({ length: ATOM_BUCKETS }, (_unused, index) => index);
            const atomBlock = repeatedBlock(ATOM_ELEMENT, ATOM_BLOCK, ATOM_BLOCKS);
            await writeDocument(
                connection,
                `SELECT '{"main_listing":{"total_atoms":${totalAtoms}},"export":{"AtomisticExporter":{' || `
                + buckets
                    .map((index) => `'"Cluster ${index + 1}":[' || ${atomBlock} || ']'`)
                    .join(" || ',' || ")
                + " || '}}}' AS payload",
                parquet
            );

            const exportBytes = await sectionBytes(connection, parquet, '$.export.AtomisticExporter');
            console.log(`  seccion export=${megabytes(exportBytes)}`);
            assert.ok(
                exportBytes > V8_MAX_STRING_LENGTH,
                `la seccion export mide ${exportBytes}B, no supera el techo de ${V8_MAX_STRING_LENGTH}B`
            );
        } finally {
            connection.closeSync();
        }

        console.log('  leyendo con readWorkflowExposurePayload...');
        const result = await readWorkflowExposurePayload(parquet);
        assert.ok(result.exportData, 'no llego export data');
        const section = (result.exportData.export as JsonObject).AtomisticExporter as JsonObject;
        assert.ok('__parquet_source__' in section, 'el atomistic deberia venir como referencia a parquet');

        console.log(`  generando GLB... (heap ${heapUsedMb()})`);
        const { input, staged } = buildExportInput('AtomisticExporter', dir);
        await exportAtomisticArtifact(input, section as never, 'atoms.glb', 'cluster-1');
        assert.equal(staged.length, 1, 'el exportador no produjo un GLB');
        console.log(`  glb=${megabytes(staged[0].byteLength)} (heap ${heapUsedMb()})`);
        assert.ok(staged[0].byteLength > totalAtoms * 6 * 4 * 0.9, 'el GLB no contiene todos los atomos');
    });

const checkOversizedSubListing = (): Promise<void> =>
    withTempDir('limit-sublisting', async (dir) => {
        const parquet = path.join(dir, 'interface_mesh.parquet');
        const connection = await DuckDBConnection.create();

        try {
            console.log('\n[sub-listing por encima del techo de V8]');
            console.log(`  armando documento (${SUB_LISTING_ROWS} filas anchas)...`);
            await writeDocument(
                connection,
                `SELECT '{"main_listing":{"total_facets":${SUB_LISTING_ROWS}},"sub_listings":{"points":[' || `
                + `${jsonBlock(SUB_LISTING_ELEMENT, SUB_LISTING_ROWS)} || ']}}' AS payload`,
                parquet
            );

            const subListingBytes = await sectionBytes(connection, parquet, '$.sub_listings.points');
            console.log(`  seccion sub_listings.points=${megabytes(subListingBytes)}`);
            assert.ok(
                subListingBytes > V8_MAX_STRING_LENGTH,
                `la seccion mide ${subListingBytes}B, no supera el techo de ${V8_MAX_STRING_LENGTH}B`
            );
        } finally {
            connection.closeSync();
        }

        console.log('  leyendo con readWorkflowExposurePayload...');
        const result = await readWorkflowExposurePayload(parquet);
        assert.deepEqual(result.subListingNames, ['points']);
        const [source] = result.subListings;
        assert.equal(source.rowCount, SUB_LISTING_ROWS);

        console.log('  recorriendo las filas en lotes...');
        let seen = 0;
        let largestBatch = 0;
        let firstRow: JsonObject | null = null;
        let lastRow: JsonObject | null = null;
        for await (const batch of source.readBatches()) {
            firstRow ??= batch[0];
            lastRow = batch[batch.length - 1];
            largestBatch = Math.max(largestBatch, batch.length);
            seen += batch.length;
        }

        console.log(`  filas=${seen} lote-mayor=${largestBatch} (heap ${heapUsedMb()})`);
        assert.equal(seen, SUB_LISTING_ROWS, 'se perdieron filas del sub-listing');
        assert.ok(largestBatch <= 20_000, `los lotes deberian estar acotados, el mayor fue ${largestBatch}`);
        assert.equal(firstRow?.row_id, 0, 'la primera fila no es la del documento');
        assert.equal(lastRow?.row_id, SUB_LISTING_ROWS - 1, 'la ultima fila no es la del documento');
    });

const main = async (): Promise<void> => {
    console.log(`techo de cadena de V8: ${V8_MAX_STRING_LENGTH} caracteres`);
    await checkOversizedMesh();
    await checkOversizedAtomistic();
    await checkOversizedSubListing();
    console.log('\nTodo OK: ninguna seccion por encima del techo rompio la lectura');
};

void main().then(() => process.exit(0));
