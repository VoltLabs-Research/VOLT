import { DuckDBConnection } from '@duckdb/node-api';
import { ObjectBucketName } from '@shared/contracts/types/http-object-store';
import { logger } from '@shared/infrastructure/logger';
import { stageExportBufferUpload, YIELD_INTERVAL, yieldToEventLoop } from '@modules/plugin/services/exports/export-node-processor-shared';
import { generateEmptyLineGLB as generateEmptyGlb } from '@modules/plugin/services/exports/line-exporter';
import { readMeshParquetSource } from '@modules/plugin/services/exports/export-node-processor-types';
import { dropEnclosingComponent } from '@modules/plugin/services/exports/mesh-component-filter';
import { clipMeshToPeriodicCell } from '@modules/plugin/services/exports/mesh-periodic-clipping';
import { sqlString } from '@modules/plugin/services/properties/duckdb-sql-escaping';
import type { ExportExecutionInput, ExportMaterial, InlineMeshInput, MeshExportOptions, MeshInput } from '@modules/plugin/services/exports/export-node-processor-types';
import type { MeshDomain, MeshParquetSource } from '@shared/contracts/types/workflow-exposure';
import spatialAssembler from '@voltstack/spatial-assembler';

const computeBounds = (positions: Float32Array) => {
    const bounds = {
        minX: Infinity,
        minY: Infinity,
        minZ: Infinity,
        maxX: -Infinity,
        maxY: -Infinity,
        maxZ: -Infinity
    };

    for (let index = 0; index < positions.length; index += 3) {
        bounds.minX = Math.min(bounds.minX, positions[index]);
        bounds.minY = Math.min(bounds.minY, positions[index + 1]);
        bounds.minZ = Math.min(bounds.minZ, positions[index + 2]);
        bounds.maxX = Math.max(bounds.maxX, positions[index]);
        bounds.maxY = Math.max(bounds.maxY, positions[index + 1]);
        bounds.maxZ = Math.max(bounds.maxZ, positions[index + 2]);
    }

    return bounds;
};

const computeNormals = (positions: Float32Array, indices: Uint32Array): Float32Array => {
    const normals = new Float32Array(positions.length);

    for (let index = 0; index < indices.length; index += 3) {
        const ia = indices[index] * 3;
        const ib = indices[index + 1] * 3;
        const ic = indices[index + 2] * 3;

        const ax = positions[ia];
        const ay = positions[ia + 1];
        const az = positions[ia + 2];
        const bx = positions[ib];
        const by = positions[ib + 1];
        const bz = positions[ib + 2];
        const cx = positions[ic];
        const cy = positions[ic + 1];
        const cz = positions[ic + 2];

        const abx = bx - ax;
        const aby = by - ay;
        const abz = bz - az;
        const acx = cx - ax;
        const acy = cy - ay;
        const acz = cz - az;

        const nx = aby * acz - abz * acy;
        const ny = abz * acx - abx * acz;
        const nz = abx * acy - aby * acx;

        normals[ia] += nx;
        normals[ia + 1] += ny;
        normals[ia + 2] += nz;
        normals[ib] += nx;
        normals[ib + 1] += ny;
        normals[ib + 2] += nz;
        normals[ic] += nx;
        normals[ic + 1] += ny;
        normals[ic + 2] += nz;
    }

    for (let index = 0; index < normals.length; index += 3) {
        const nx = normals[index];
        const ny = normals[index + 1];
        const nz = normals[index + 2];
        const length = Math.hypot(nx, ny, nz) || 1;
        normals[index] = nx / length;
        normals[index + 1] = ny / length;
        normals[index + 2] = nz / length;
    }

    return normals;
};

interface ProcessedMesh {
    positions: Float32Array;
    normals: Float32Array;
    indices: Uint32Array;
    colors?: Float32Array;
    bounds: {
        minX: number;
        minY: number;
        minZ: number;
        maxX: number;
        maxY: number;
        maxZ: number;
    };
}

const CAP_COLOR: readonly [number, number, number, number] = [0.8, 0.8, 1.0, 1.0];

const SURFACE_COLOR: readonly [number, number, number, number] = [1, 1, 1, 1];

export const separateCapVertices = (
    positions: Float32Array,
    indices: Uint32Array,
    surfaceTriangleCount: number
): { positions: Float32Array; indices: Uint32Array; colors: Float32Array } => {
    const surfaceIndexCount = surfaceTriangleCount * 3;
    const capIndexCount = indices.length - surfaceIndexCount;
    const baseVertexCount = positions.length / 3;

    const nextPositions = new Float32Array(positions.length + capIndexCount * 3);
    nextPositions.set(positions);
    const nextIndices = new Uint32Array(indices.length);
    nextIndices.set(indices.subarray(0, surfaceIndexCount));
    const colors = new Float32Array((baseVertexCount + capIndexCount) * 4);

    for (let vertex = 0; vertex < baseVertexCount; vertex += 1) {
        colors.set(SURFACE_COLOR, vertex * 4);
    }

    for (let offset = 0; offset < capIndexCount; offset += 1) {
        const source = indices[surfaceIndexCount + offset];
        const target = baseVertexCount + offset;
        nextPositions[target * 3] = positions[source * 3];
        nextPositions[target * 3 + 1] = positions[source * 3 + 1];
        nextPositions[target * 3 + 2] = positions[source * 3 + 2];
        colors.set(CAP_COLOR, target * 4);
        nextIndices[surfaceIndexCount + offset] = target;
    }

    return {
        positions: nextPositions,
        indices: nextIndices,
        colors
    };
};

const reverseWinding = (indices: Uint32Array): void => {
    for (let index = 0; index + 2 < indices.length; index += 3) {
        const second = indices[index + 1];
        indices[index + 1] = indices[index + 2];
        indices[index + 2] = second;
    }
};

interface FinishMeshOptions {
    smoothIterations: number | undefined;
    reverseOrientation: boolean;
    interiorOnly: boolean;
    cell: MeshDomain | null;
}

const finishMesh = (
    positions: Float32Array,
    indices: Uint32Array,
    options: FinishMeshOptions
): ProcessedMesh => {
    if (options.smoothIterations && options.smoothIterations > 0) {
        spatialAssembler.taubinSmooth(positions, indices, options.smoothIterations);
    }

    if (options.reverseOrientation) {
        reverseWinding(indices);
    }

    let workingPositions = positions;
    let workingIndices = indices;
    let colors: Float32Array | undefined;

    if (options.interiorOnly) {
        const filtered = dropEnclosingComponent(workingPositions, workingIndices);
        workingPositions = filtered.positions;
        workingIndices = filtered.indices;
    }

    if (options.cell) {
        const clipped = clipMeshToPeriodicCell(workingPositions, workingIndices, options.cell);
        if (clipped) {
            workingPositions = clipped.positions;
            workingIndices = clipped.indices;
            if (clipped.capTriangleCount > 0) {
                const separated = separateCapVertices(
                    clipped.positions,
                    clipped.indices,
                    clipped.surfaceTriangleCount
                );
                workingPositions = separated.positions;
                workingIndices = separated.indices;
                colors = separated.colors;
            }
            logger.info(
                {
                    surfaceTriangles: clipped.surfaceTriangleCount,
                    capTriangles: clipped.capTriangleCount
                },
                'Contained surface mesh inside its periodic cell'
            );
        }
    }

    return {
        positions: workingPositions,
        normals: computeNormals(workingPositions, workingIndices),
        indices: workingIndices,
        colors,
        bounds: computeBounds(workingPositions)
    };
};

const processMeshFromParquet = async (
    source: MeshParquetSource,
    finishOptions: FinishMeshOptions
): Promise<ProcessedMesh | null> => {
    const connection = await DuckDBConnection.create();

    try {
        const countsReader = await connection.runAndReadAll(
            `SELECT (SELECT COUNT(*) FROM read_parquet(${sqlString(source.vertices)})) AS vertices, `
            + `(SELECT COUNT(*) FROM read_parquet(${sqlString(source.facets)})) AS facets`
        );
        const counts = countsReader.getRowObjectsJS()[0] ?? {};
        const vertexCount = Number(counts.vertices ?? 0);
        const facetCount = Number(counts.facets ?? 0);
        if (vertexCount === 0 || facetCount === 0) {
            return null;
        }

        const positions = new Float32Array(vertexCount * 3);
        const positionsResult = await connection.stream(
            'SELECT CAST(x AS FLOAT) AS x, CAST(y AS FLOAT) AS y, CAST(z AS FLOAT) AS z '
            + `FROM read_parquet(${sqlString(source.vertices)}) ORDER BY slot`
        );
        let positionOffset = 0;
        let sinceLastYield = 0;
        for (let chunk = await positionsResult.fetchChunk(); chunk; chunk = await positionsResult.fetchChunk()) {
            const rows = chunk.rowCount;
            if (rows === 0) break;
            const xs = chunk.getColumnVector(0);
            const ys = chunk.getColumnVector(1);
            const zs = chunk.getColumnVector(2);
            for (let row = 0; row < rows; row += 1) {
                const base = positionOffset * 3;
                positions[base] = Number(xs.getItem(row) ?? 0);
                positions[base + 1] = Number(ys.getItem(row) ?? 0);
                positions[base + 2] = Number(zs.getItem(row) ?? 0);
                positionOffset += 1;
            }
            sinceLastYield += rows;
            if (sinceLastYield >= YIELD_INTERVAL) {
                sinceLastYield = 0;
                await yieldToEventLoop();
            }
        }

        const indices = new Uint32Array(facetCount * 3);
        const trianglesResult = await connection.stream(
            'WITH vertex_map AS ('
            + `SELECT vertex_id, MAX(slot) AS slot FROM read_parquet(${sqlString(source.vertices)}) `
            + 'WHERE vertex_id IS NOT NULL GROUP BY vertex_id) '
            + 'SELECT CAST(va.slot AS INTEGER) AS ia, CAST(vb.slot AS INTEGER) AS ib, '
            + 'CAST(vc.slot AS INTEGER) AS ic '
            + `FROM read_parquet(${sqlString(source.facets)}) f `
            + 'JOIN vertex_map va ON va.vertex_id = f.a '
            + 'JOIN vertex_map vb ON vb.vertex_id = f.b '
            + 'JOIN vertex_map vc ON vc.vertex_id = f.c '
            + 'ORDER BY f.ord'
        );
        let indexOffset = 0;
        sinceLastYield = 0;
        for (let chunk = await trianglesResult.fetchChunk(); chunk; chunk = await trianglesResult.fetchChunk()) {
            const rows = chunk.rowCount;
            if (rows === 0) break;
            const ia = chunk.getColumnVector(0);
            const ib = chunk.getColumnVector(1);
            const ic = chunk.getColumnVector(2);
            for (let row = 0; row < rows; row += 1) {
                indices[indexOffset] = Number(ia.getItem(row) ?? 0);
                indices[indexOffset + 1] = Number(ib.getItem(row) ?? 0);
                indices[indexOffset + 2] = Number(ic.getItem(row) ?? 0);
                indexOffset += 3;
            }
            sinceLastYield += rows;
            if (sinceLastYield >= YIELD_INTERVAL) {
                sinceLastYield = 0;
                await yieldToEventLoop();
            }
        }

        if (indexOffset === 0) {
            return null;
        }

        logger.info(
            {
                vertexCount,
                facetCount,
                triangleCount: indexOffset / 3
            },
            'Built mesh geometry from parquet source'
        );

        return finishMesh(
            positions,
            indexOffset < indices.length ? indices.subarray(0, indexOffset) : indices,
            finishOptions
        );
    } finally {
        connection.closeSync();
    }
};

const processMesh = (
    mesh: InlineMeshInput,
    finishOptions: FinishMeshOptions
): ProcessedMesh | null => {
    if (mesh.vertices.length === 0 || mesh.facets.length === 0) {
        return null;
    }

    const positions = new Float32Array(mesh.vertices.length * 3);
    mesh.vertices.forEach((vertex, index) => {
        const base = index * 3;
        positions[base] = vertex.position[0];
        positions[base + 1] = vertex.position[1];
        positions[base + 2] = vertex.position[2];
    });

    const vertexIndices = new Map<number, number>();
    mesh.vertices.forEach((vertex, index) => {
        vertexIndices.set(vertex.index, index);
    });

    const resolvedFacets = mesh.facets
        .map((facet) => {
            const first = vertexIndices.get(facet.vertices[0]);
            const second = vertexIndices.get(facet.vertices[1]);
            const third = vertexIndices.get(facet.vertices[2]);

            if (
                first === undefined
                || second === undefined
                || third === undefined
            ) {
                return null;
            }

            return [first, second, third] as const;
        })
        .filter((facet): facet is readonly [number, number, number] => facet !== null);
    if (resolvedFacets.length === 0) {
        return null;
    }

    const indices = new Uint32Array(resolvedFacets.length * 3);
    resolvedFacets.forEach((facet, index) => {
        const base = index * 3;
        indices[base] = facet[0];
        indices[base + 1] = facet[1];
        indices[base + 2] = facet[2];
    });

    return finishMesh(positions, indices, finishOptions);
};

const DEFAULT_MESH_MATERIAL: ExportMaterial = {
    baseColor: [1, 1, 1, 1],
    metallic: 0,
    roughness: 1,
    emissive: [0, 0, 0]
};

const DEFAULT_MESH_SMOOTH_ITERATIONS = 8;

const MAX_MESH_SMOOTH_ITERATIONS = 50;

const resolveSmoothIterations = (requested: number | undefined): number => {
    if (requested === undefined) {
        return DEFAULT_MESH_SMOOTH_ITERATIONS;
    }
    if (!Number.isFinite(requested) || requested <= 0) {
        return 0;
    }
    return Math.min(Math.round(requested), MAX_MESH_SMOOTH_ITERATIONS);
};

export const exportMeshArtifact = async (
    input: ExportExecutionInput,
    exportData: MeshInput,
    objectPath: string,
    ownerClusterId: string,
    options: MeshExportOptions
): Promise<boolean> => {
    const material: ExportMaterial = {
        ...DEFAULT_MESH_MATERIAL,
        ...options.material
    };
    const parquetSource = readMeshParquetSource(exportData);
    const finishOptions: FinishMeshOptions = {
        smoothIterations: resolveSmoothIterations(options.smoothIterations),
        reverseOrientation: options.reverseOrientation ?? false,
        interiorOnly: options.interiorOnly ?? false,
        cell: parquetSource?.cell ?? null
    };
    const processed = parquetSource
        ? await processMeshFromParquet(parquetSource, finishOptions)
        : processMesh(exportData as InlineMeshInput, finishOptions);
    if (!processed) {
        await stageExportBufferUpload(input, {
            exporter: 'MeshExporter',
            bucket: ObjectBucketName.Models,
            buffer: generateEmptyGlb(material),
            contentType: 'model/gltf-binary',
            objectPath,
            ownerClusterId
        });
        return true;
    }

    const buffer = spatialAssembler.generateMeshGLB(
        processed.positions,
        processed.normals,
        processed.indices,
        Boolean(processed.colors),
        processed.colors,
        processed.bounds,
        {
            ...material,
            doubleSided: options.enableDoubleSided ?? true
        }
    );

    await stageExportBufferUpload(input, {
        exporter: 'MeshExporter',
        bucket: ObjectBucketName.Models,
        buffer,
        contentType: 'model/gltf-binary',
        objectPath,
        ownerClusterId
    });

    return true;
};
