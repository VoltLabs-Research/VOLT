import path from 'node:path';

import type { NativeModuleLoader } from '@/core/runtime/infrastructure/native/NativeModuleLoader';

import { buildArtifactReportInput, ExportExecutionInput, MeshExportOptions, MeshFacet, MeshInput, ObjectBucketName, isRecord } from '@/modules/plugin/application/exports/ExportNodeProcessor.shared';

interface RawMeshVertex {
    index: number;
    position: [number, number, number];
}

interface RawMeshFacet {
    vertices: [number, number, number];
}

interface RawMeshInput {
    vertices?: RawMeshVertex[];
    facets?: RawMeshFacet[];
}

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

const normalizeMesh = (value: Record<string, unknown>): MeshInput => {
    const mesh = value as RawMeshInput;
    const vertices = Array.isArray(mesh.vertices) ? mesh.vertices : [];
    const facets = Array.isArray(mesh.facets) ? mesh.facets : [];

    return {
        vertices: vertices
            .map((vertex) => {
                if (!isRecord(vertex) || !Array.isArray(vertex.position) || vertex.position.length < 3) {
                    return null;
                }

                const [x, y, z] = vertex.position;
                if (
                    !Number.isInteger(vertex.index)
                    || typeof x !== 'number'
                    || !Number.isFinite(x)
                    || typeof y !== 'number'
                    || !Number.isFinite(y)
                    || typeof z !== 'number'
                    || !Number.isFinite(z)
                ) {
                    return null;
                }

                return {
                    index: vertex.index,
                    position: [x, y, z] as [number, number, number]
                };
            })
            .filter((vertex): vertex is MeshInput['vertices'][number] => vertex !== null),
        facets: facets
            .map((facet) => {
                if (!isRecord(facet) || !Array.isArray(facet.vertices) || facet.vertices.length < 3) {
                    return null;
                }

                const [first, second, third] = facet.vertices;
                if (!Number.isInteger(first) || !Number.isInteger(second) || !Number.isInteger(third)) {
                    return null;
                }

                return {
                    vertices: [first, second, third] as [number, number, number]
                };
            })
            .filter((facet): facet is MeshFacet => facet !== null)
    };
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

const processMesh = (
    mesh: MeshInput,
    smoothIterations: number | undefined,
    nativeModuleLoader: NativeModuleLoader
): {
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
} | null => {
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
                typeof first !== 'number'
                || typeof second !== 'number'
                || typeof third !== 'number'
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

    const normalizedSmoothIterations = typeof smoothIterations === 'number'
        && Number.isInteger(smoothIterations)
        && smoothIterations > 0
        ? smoothIterations
        : 0;
    if (normalizedSmoothIterations > 0) {
        nativeModuleLoader.getExporterModule().taubinSmooth(positions, indices, normalizedSmoothIterations);
    }

    return {
        positions,
        normals: computeNormals(positions, indices),
        indices,
        bounds: computeBounds(positions)
    };
};

export const exportMeshArtifact = async (
    nativeModuleLoader: NativeModuleLoader,
    input: ExportExecutionInput,
    exportData: Record<string, unknown>,
    objectPath: string,
    ownerClusterId: string,
    options: MeshExportOptions
): Promise<boolean> => {
    const mesh = normalizeMesh(exportData);
    const processed = processMesh(mesh, options.smoothIterations, nativeModuleLoader);
    if (!processed) {
        return false;
    }

    const buffer = nativeModuleLoader.getExporterModule().generateMeshGLB(
        processed.positions,
        processed.normals,
        processed.indices,
        false,
        undefined,
        processed.bounds,
        {
            baseColor: options.material?.baseColor || [0.8, 0.8, 0.85, 1],
            metallic: options.material?.metallic ?? 0.05,
            roughness: options.material?.roughness ?? 0.9,
            emissive: options.material?.emissive || [0, 0, 0],
            doubleSided: options.enableDoubleSided ?? true
        }
    );

    await input.artifactUploadBatch.stageBufferUpload({
        ownerClusterId,
        bucket: ObjectBucketName.Models,
        objectKey: objectPath,
        buffer,
        contentType: 'model/gltf-binary',
        fileName: path.basename(objectPath),
        reportArtifact: buildArtifactReportInput(
            input,
            'MeshExporter',
            input.exposure.export!,
            objectPath,
            ObjectBucketName.Models
        )
    });

    return true;
};
