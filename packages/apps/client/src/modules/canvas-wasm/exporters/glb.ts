import type { Bounds, ExportMaterial } from './types';

// Same GLB layout as @voltstack/spatial-assembler (generatePointCloudGLB / generateMeshGLB), so the viewer
// treats browser-built scenes exactly like the ones the cluster uploads.

const encoder = new TextEncoder();
const FLOAT = 5126;
const UNSIGNED_SHORT = 5123;
const UNSIGNED_INT = 5125;
const ARRAY_BUFFER = 34962;
const ELEMENT_ARRAY_BUFFER = 34963;

const writeAscii = (view: DataView, offset: number, value: string) => {
    for (let index = 0; index < value.length; index += 1) {
        view.setUint8(offset + index, value.charCodeAt(index));
    }
};

interface BinaryChunk {
    data: ArrayBufferView;
    target: number;
}

// Every chunk is a 4-byte multiple except a trailing u16 index buffer, which the BIN padding covers.
const writeGlb = (json: Record<string, unknown>, chunks: BinaryChunk[]): Blob => {
    let byteOffset = 0;
    const bufferViews = chunks.map(({ data, target }) => {
        const view = { buffer: 0, byteOffset, byteLength: data.byteLength, target };
        byteOffset += data.byteLength;
        return view;
    });
    const binLength = byteOffset;
    const binPadding = (4 - (binLength % 4)) % 4;

    const jsonBytes = encoder.encode(JSON.stringify({
        ...json,
        bufferViews,
        buffers: [{ byteLength: binLength }]
    }));
    const jsonPadding = (4 - (jsonBytes.byteLength % 4)) % 4;
    const total = 12 + 8 + jsonBytes.byteLength + jsonPadding + 8 + binLength + binPadding;

    const file = new ArrayBuffer(total);
    const view = new DataView(file);
    const bytes = new Uint8Array(file);
    writeAscii(view, 0, 'glTF');
    view.setUint32(4, 2, true);
    view.setUint32(8, total, true);
    view.setUint32(12, jsonBytes.byteLength + jsonPadding, true);
    writeAscii(view, 16, 'JSON');
    bytes.set(jsonBytes, 20);
    bytes.fill(0x20, 20 + jsonBytes.byteLength, 20 + jsonBytes.byteLength + jsonPadding);

    const binHeader = 20 + jsonBytes.byteLength + jsonPadding;
    view.setUint32(binHeader, binLength + binPadding, true);
    writeAscii(view, binHeader + 4, 'BIN\0');
    let cursor = binHeader + 8;
    for (const { data } of chunks) {
        bytes.set(new Uint8Array(data.buffer, data.byteOffset, data.byteLength), cursor);
        cursor += data.byteLength;
    }

    return new Blob([file], { type: 'model/gltf-binary' });
};

export const computeBounds = (positions: Float32Array): Bounds => {
    const min: Bounds['min'] = [Infinity, Infinity, Infinity];
    const max: Bounds['max'] = [-Infinity, -Infinity, -Infinity];
    for (let index = 0; index < positions.length; index += 3) {
        for (let axis = 0; axis < 3; axis += 1) {
            const value = positions[index + axis];
            if (value < min[axis]) min[axis] = value;
            if (value > max[axis]) max[axis] = value;
        }
    }
    return positions.length > 0 ? { min, max } : { min: [0, 0, 0], max: [0, 0, 0] };
};

export const buildPointCloudGlb = (positions: Float32Array, colors: Float32Array): Blob => {
    const count = positions.length / 3;
    const { min, max } = computeBounds(positions);
    return writeGlb({
        asset: { version: '2.0', generator: 'Volt WASM' },
        scene: 0,
        scenes: [{ nodes: [0] }],
        nodes: [{ mesh: 0, name: 'Atoms' }],
        meshes: [{ primitives: [{ attributes: { POSITION: 0, COLOR_0: 1 }, mode: 0 }], name: 'AtomCloud' }],
        accessors: [
            { bufferView: 0, componentType: FLOAT, count, type: 'VEC3', min, max },
            { bufferView: 1, componentType: FLOAT, count, type: 'VEC3' }
        ]
    }, [
        { data: positions, target: ARRAY_BUFFER },
        { data: colors, target: ARRAY_BUFFER }
    ]);
};

export interface MeshGeometry {
    positions: Float32Array;
    normals: Float32Array;
    indices: Uint16Array | Uint32Array;
    // RGBA per vertex.
    colors?: Float32Array;
    bounds: Bounds;
}

export interface MeshMaterial extends ExportMaterial {
    doubleSided: boolean;
}

export const buildMeshGlb = (geometry: MeshGeometry, material: MeshMaterial): Blob => {
    const vertexCount = geometry.positions.length / 3;
    const { colors } = geometry;
    const accessors: Record<string, unknown>[] = [
        {
            bufferView: 0,
            componentType: FLOAT,
            count: vertexCount,
            type: 'VEC3',
            min: geometry.bounds.min,
            max: geometry.bounds.max
        },
        { bufferView: 1, componentType: FLOAT, count: vertexCount, type: 'VEC3' }
    ];
    const chunks: BinaryChunk[] = [
        { data: geometry.positions, target: ARRAY_BUFFER },
        { data: geometry.normals, target: ARRAY_BUFFER }
    ];
    if (colors) {
        accessors.push({ bufferView: 2, componentType: FLOAT, count: vertexCount, type: 'VEC4' });
        chunks.push({ data: colors, target: ARRAY_BUFFER });
    }
    accessors.push({
        bufferView: chunks.length,
        componentType: geometry.indices instanceof Uint16Array ? UNSIGNED_SHORT : UNSIGNED_INT,
        count: geometry.indices.length,
        type: 'SCALAR'
    });
    chunks.push({ data: geometry.indices, target: ELEMENT_ARRAY_BUFFER });

    return writeGlb({
        asset: { version: '2.0', generator: 'Volt WASM' },
        scene: 0,
        scenes: [{ nodes: [0] }],
        nodes: [{ mesh: 0, name: 'Mesh' }],
        materials: [{
            pbrMetallicRoughness: {
                baseColorFactor: material.baseColor,
                metallicFactor: material.metallic,
                roughnessFactor: material.roughness
            },
            emissiveFactor: material.emissive,
            doubleSided: material.doubleSided
        }],
        meshes: [{
            primitives: [{
                attributes: colors ? { POSITION: 0, NORMAL: 1, COLOR_0: 2 } : { POSITION: 0, NORMAL: 1 },
                indices: accessors.length - 1,
                material: 0,
                mode: 4
            }],
            name: 'MeshGeometry'
        }],
        accessors
    }, chunks);
};

export const buildEmptyMeshGlb = (material: MeshMaterial): Blob => buildMeshGlb({
    positions: new Float32Array(0),
    normals: new Float32Array(0),
    indices: new Uint32Array(0),
    bounds: { min: [0, 0, 0], max: [0, 0, 0] }
}, material);
