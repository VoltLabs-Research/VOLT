import { ObjectBucketName } from '@/core/storage/contracts/http-object-store';
import { stageExportBufferUpload } from '@/modules/plugin/application/exports/export-node-processor-shared';
import type { ExportExecutionInput, ExportMaterial, MeshExportOptions, MeshInput } from '@/modules/plugin/application/exports/export-node-processor-types';
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

const processMesh = (
    mesh: MeshInput,
    smoothIterations: number | undefined
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

const DEFAULT_MESH_MATERIAL: ExportMaterial = {
    baseColor: [0.8, 0.8, 0.85, 1],
    metallic: 0.05,
    roughness: 0.9,
    emissive: [0, 0, 0]
};

const generateEmptyMeshGLB = (material: ExportMaterial): Buffer => (
    spatialAssembler.generateMeshGLB(
        new Float32Array(0),
        new Float32Array(0),
        new Uint32Array(0),
        false,
        undefined,
        {
            minX: 0,
            minY: 0,
            minZ: 0,
            maxX: 0,
            maxY: 0,
            maxZ: 0
        },
        {
            ...material,
            doubleSided: true
        }
    )
);

export const exportMeshArtifact = async (
    input: ExportExecutionInput,
    exportData: MeshInput,
    objectPath: string,
    ownerClusterId: string,
    options: MeshExportOptions
): Promise<boolean> => {
    const material: ExportMaterial = { ...DEFAULT_MESH_MATERIAL, ...options.material };
    const processed = processMesh(exportData, options.smoothIterations);
    if (!processed) {
        await stageExportBufferUpload(input, {
            exporter: 'MeshExporter',
            bucket: ObjectBucketName.Models,
            buffer: generateEmptyMeshGLB(material),
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
