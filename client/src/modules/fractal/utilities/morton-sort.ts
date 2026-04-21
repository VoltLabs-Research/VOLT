// Morton / Z-order curve utilities. Used to reorder atoms by spatial locality
// so that setDrawRange(0, N * ratio) yields a visually uniform subset at any
// LOD tier. The actual heavy sort runs in a worker; these helpers are reused
// by both the worker and (for small counts) the main thread.

const part1By2 = (x: number): number => {
    let v = x & 0x3ff;
    v = (v | (v << 16)) & 0x030000ff;
    v = (v | (v << 8)) & 0x0300f00f;
    v = (v | (v << 4)) & 0x030c30c3;
    v = (v | (v << 2)) & 0x09249249;
    return v >>> 0;
};

const morton3 = (x: number, y: number, z: number): number => {
    return (part1By2(x) | (part1By2(y) << 1) | (part1By2(z) << 2)) >>> 0;
};

export interface BoundingBox {
    minX: number;
    minY: number;
    minZ: number;
    maxX: number;
    maxY: number;
    maxZ: number;
}

const RESOLUTION = 1024;

export const computeMortonCodes = (positions: Float32Array, bbox: BoundingBox): Uint32Array => {
    const count = positions.length / 3;
    const codes = new Uint32Array(count);
    const sx = bbox.maxX - bbox.minX;
    const sy = bbox.maxY - bbox.minY;
    const sz = bbox.maxZ - bbox.minZ;
    const invX = sx > 0 ? (RESOLUTION - 1) / sx : 0;
    const invY = sy > 0 ? (RESOLUTION - 1) / sy : 0;
    const invZ = sz > 0 ? (RESOLUTION - 1) / sz : 0;

    for (let i = 0; i < count; i += 1) {
        const base = i * 3;
        const x = Math.max(0, Math.min(RESOLUTION - 1, Math.round((positions[base] - bbox.minX) * invX)));
        const y = Math.max(0, Math.min(RESOLUTION - 1, Math.round((positions[base + 1] - bbox.minY) * invY)));
        const z = Math.max(0, Math.min(RESOLUTION - 1, Math.round((positions[base + 2] - bbox.minZ) * invZ)));
        codes[i] = morton3(x, y, z);
    }

    return codes;
};

export const buildPermutation = (codes: Uint32Array): Uint32Array => {
    const count = codes.length;
    const indices = new Uint32Array(count);
    for (let i = 0; i < count; i += 1) indices[i] = i;
    const asArray = Array.from(indices);
    asArray.sort((a, b) => codes[a] - codes[b]);
    return Uint32Array.from(asArray);
};

export const computeBoundingBox = (positions: Float32Array): BoundingBox => {
    let minX = Infinity;
    let minY = Infinity;
    let minZ = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    let maxZ = -Infinity;
    for (let i = 0; i < positions.length; i += 3) {
        const x = positions[i];
        const y = positions[i + 1];
        const z = positions[i + 2];
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (z < minZ) minZ = z;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
        if (z > maxZ) maxZ = z;
    }
    if (minX === Infinity) {
        return { minX: 0, minY: 0, minZ: 0, maxX: 0, maxY: 0, maxZ: 0 };
    }
    return { minX, minY, minZ, maxX, maxY, maxZ };
};
