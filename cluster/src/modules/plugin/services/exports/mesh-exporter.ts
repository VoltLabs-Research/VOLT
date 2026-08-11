import { DuckDBConnection } from '@duckdb/node-api';
import { ObjectBucketName } from '@shared/contracts/types/http-object-store';
import { logger } from '@shared/infrastructure/logger';
import { stageExportBufferUpload, YIELD_INTERVAL, yieldToEventLoop } from '@modules/plugin/services/exports/export-node-processor-shared';
import { generateEmptyLineGLB as generateEmptyGlb } from '@modules/plugin/services/exports/line-exporter';
import { readMeshParquetSource } from '@modules/plugin/services/exports/export-node-processor-types';
import { sqlString } from '@modules/plugin/services/properties/duckdb-sql-escaping';
import type { ExportExecutionInput, ExportMaterial, InlineMeshInput, MeshExportOptions, MeshInput } from '@modules/plugin/services/exports/export-node-processor-types';
import type { MeshParquetSource } from '@shared/contracts/types/workflow-exposure';
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
    bounds: {
        minX: number;
        minY: number;
        minZ: number;
        maxX: number;
        maxY: number;
        maxZ: number;
    };
}

const finishMesh = (
    positions: Float32Array,
    indices: Uint32Array,
    smoothIterations: number | undefined
): ProcessedMesh => {
    if (smoothIterations && smoothIterations > 0) {
        spatialAssembler.taubinSmooth(positions, indices, smoothIterations);
    }

    return {
        positions,
        normals: computeNormals(positions, indices),
        indices,
        bounds: computeBounds(positions)
    };
};

/**
 * Builds the geometry straight from the two parquet tables a payload-document mesh was
 * split into.
 *
 * The facet-to-vertex resolution is the join DuckDB does below, so the 16-million-entry
 * `Map` the inline path needs never exists; `MAX(slot)` reproduces its last-write-wins
 * behaviour for a repeated vertex index, and the inner joins drop a facet that names an
 * unknown vertex exactly as the inline filter did. Rows arrive one chunk at a time and
 * go straight into the typed arrays, so peak memory is the geometry itself.
 */
const processMeshFromParquet = async (
    source: MeshParquetSource,
    smoothIterations: number | undefined
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
        /*
         * `FLOAT` and `INTEGER` rather than the parquet's `DOUBLE`/`BIGINT`: the node
         * binding hands back a `bigint` object for every BIGINT value, so the index
         * columns alone allocated one per element. A mesh cannot exceed the `Uint32Array`
         * that carries its indices anyway, and the positions land in a `Float32Array`.
         */
        const positionsResult = await connection.stream(
            'SELECT CAST(x AS FLOAT) AS x, CAST(y AS FLOAT) AS y, CAST(z AS FLOAT) AS z '
            + `FROM read_parquet(${sqlString(source.vertices)}) ORDER BY slot`
        );
        let positionOffset = 0;
        /*
         * Yielding per chunk means one event-loop round-trip every 2048 rows, and a chunk
         * here is a fraction of a millisecond of work — so the loop paid ~530 round-trips
         * to fill both arrays and inherited the loop's queue latency on every one of them.
         * `YIELD_INTERVAL` is the interval the atomistic exporter already uses, and it
         * keeps the loop responsive at a hundredth of the round-trips.
         */
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

        /* Upper bound: the joins can only drop facets, never add them. */
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
            smoothIterations
        );
    } finally {
        connection.closeSync();
    }
};

const processMesh = (
    mesh: InlineMeshInput,
    smoothIterations: number | undefined
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

    return finishMesh(positions, indices, smoothIterations);
};

const DEFAULT_MESH_MATERIAL: ExportMaterial = {
    baseColor: [0.8, 0.8, 0.85, 1],
    metallic: 0.05,
    roughness: 0.9,
    emissive: [0, 0, 0]
};

/**
 * Taubin iterations applied when the export node does not ask for a specific count.
 *
 * A defect mesh arrives straight off a Delaunay tessellation, so untouched it reads
 * as the pile of tetrahedra it is rather than as a surface. This matches the default
 * OVITO uses for the same mesh, and OpenDXA derives from OVITO, so the two stay
 * visually comparable for anyone checking one against the other. Taubin alternates
 * its two passes precisely so the iterations do not shrink the surface the way plain
 * Laplacian smoothing would.
 *
 * Every mesh export used to skip smoothing entirely, because the material and the
 * line options had defaults and this one did not.
 */
const DEFAULT_MESH_SMOOTH_ITERATIONS = 8;

/**
 * Upper bound on the iterations a plugin may ask for.
 *
 * The count reaches a native call that walks every triangle once per iteration, and
 * it arrives unvalidated from a plugin's own JSON. Without a ceiling a stray value
 * would keep the daemon busy for as long as the number says.
 */
const MAX_MESH_SMOOTH_ITERATIONS = 50;

const resolveSmoothIterations = (requested: number | undefined): number => {
    if (requested === undefined) {
        return DEFAULT_MESH_SMOOTH_ITERATIONS;
    }
    /* An explicit 0 means "do not smooth", so `??` above and no `||` anywhere. */
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
    const smoothIterations = resolveSmoothIterations(options.smoothIterations);
    const parquetSource = readMeshParquetSource(exportData);
    const processed = parquetSource
        ? await processMeshFromParquet(parquetSource, smoothIterations)
        : processMesh(exportData as InlineMeshInput, smoothIterations);
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
        false,
        undefined,
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
