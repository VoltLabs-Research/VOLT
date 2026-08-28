import assert from 'node:assert/strict';
import { readWorkflowExposurePayload } from '@modules/analysis/services/workflow/exposure-payload-reader';
import { exportMeshArtifact } from '@modules/plugin/services/exports/mesh-exporter';
import type { MeshInput } from '@modules/plugin/services/exports/export-node-processor-types';
import type { JsonObject } from '@shared/contracts/types/json';
import { buildExportInput } from './payload-check-harness';

const meshFile = process.argv[2];
assert.ok(meshFile, 'uso: mesh-parquet-source-check.ts <ruta_defect_mesh.parquet>');

const run = async (): Promise<void> => {
    const { listing, subListings, exportData } = await readWorkflowExposurePayload(meshFile, {
        skipSubListings: true
    });

    const mainListing = listing?.main_listing as JsonObject | undefined;
    assert.ok(mainListing, 'el payload no trae main_listing');
    const totalNodes = Number(mainListing.total_nodes ?? 0);
    const totalFacets = Number(mainListing.total_facets ?? 0);
    assert.ok(totalNodes > 0 && totalFacets > 0, 'main_listing sin geometría');
    assert.equal(subListings.length, 0, 'el mesh no debe emitir sub-listings');

    const meshSection = (exportData?.export as JsonObject | undefined)?.MeshExporter as JsonObject;
    assert.ok(meshSection, 'el payload no declara export.MeshExporter');
    const source = meshSection.__parquet_source__ as JsonObject | undefined;
    assert.ok(source, 'MeshExporter no declara __parquet_source__');
    assert.equal(typeof source.vertices, 'string');
    assert.equal(typeof source.facets, 'string');

    const { input, staged } = buildExportInput('MeshExporter', meshFile);
    const produced = await exportMeshArtifact(
        { ...input, outputFilePath: meshFile },
        meshSection as unknown as MeshInput,
        'mesh-parquet-source-check.glb',
        'cluster-1',
        {}
    );

    assert.ok(produced, 'el MeshExporter no produjo artefacto');
    assert.equal(staged.length, 1, `se esperaba 1 GLB, llegaron ${staged.length}`);
    const glb = staged[0];
    assert.ok(glb.length > 0, 'GLB vacío');
    assert.equal(glb.subarray(0, 4).toString('ascii'), 'glTF', 'el buffer no es un GLB');

    console.log(
        `ok: ${totalNodes} vértices / ${totalFacets} facetas leídos desde parquet columnar `
        + `-> GLB de ${(glb.length / 1024 / 1024).toFixed(1)} MiB`
    );
};

void run();
