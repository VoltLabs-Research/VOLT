// Why: Morton (Z-order) reorder of atoms improves delta and zstd compressibility
// because spatially adjacent atoms end up consecutive in the column layout. We
// interleave per-axis normalized coordinates into a 30-bit code (10 bits/axis)
// and stable-sort a Uint32Array of indices by that code.

const normalizeAxis = (value: number, min: number, span: number): number => {
    if (span <= 0) return 0;
    const ratio = (value - min) / span;
    if (ratio <= 0) return 0;
    if (ratio >= 1) return 0x3FF;
    return Math.floor(ratio * 0x3FF) & 0x3FF;
};

const expandBits10 = (value: number): number => {
    let v = value & 0x3FF;
    v = (v | (v << 16)) & 0x030000FF;
    v = (v | (v << 8)) & 0x0300F00F;
    v = (v | (v << 4)) & 0x030C30C3;
    v = (v | (v << 2)) & 0x09249249;
    return v >>> 0;
};

const mortonEncode = (x: number, y: number, z: number): number => {
    return (expandBits10(x) | (expandBits10(y) << 1) | (expandBits10(z) << 2)) >>> 0;
};

export interface MortonSortResult {
    order: Uint32Array;
    inverseOrder: Uint32Array;
}

export const buildMortonOrder = (
    positions: Float32Array,
    atomCount: number,
    bbox: readonly [number, number, number, number, number, number]
): MortonSortResult => {
    const codes = new Uint32Array(atomCount);
    const indices = new Uint32Array(atomCount);
    const spanX = bbox[3] - bbox[0];
    const spanY = bbox[4] - bbox[1];
    const spanZ = bbox[5] - bbox[2];

    for (let index = 0; index < atomCount; index++) {
        const base = index * 3;
        const x = normalizeAxis(positions[base], bbox[0], spanX);
        const y = normalizeAxis(positions[base + 1], bbox[1], spanY);
        const z = normalizeAxis(positions[base + 2], bbox[2], spanZ);
        codes[index] = mortonEncode(x, y, z);
        indices[index] = index;
    }

    // Why: a typed-array wrapper indirect sort keeps peak RAM low — no AoS of
    // tuples like { code, index } is materialized.
    const compareFn = (a: number, b: number): number => codes[a] - codes[b];
    const sortedIndices = Array.from(indices).sort(compareFn);
    const order = Uint32Array.from(sortedIndices);
    const inverseOrder = new Uint32Array(atomCount);
    for (let index = 0; index < atomCount; index++) {
        inverseOrder[order[index]] = index;
    }

    return { order, inverseOrder };
};

export const reorderFloat32Vec3 = (
    source: Float32Array,
    order: Uint32Array
): Float32Array => {
    const atomCount = order.length;
    const out = new Float32Array(atomCount * 3);
    for (let target = 0; target < atomCount; target++) {
        const sourceIndex = order[target] * 3;
        const targetIndex = target * 3;
        out[targetIndex] = source[sourceIndex];
        out[targetIndex + 1] = source[sourceIndex + 1];
        out[targetIndex + 2] = source[sourceIndex + 2];
    }
    return out;
};

export const reorderUint16 = (
    source: Uint16Array,
    order: Uint32Array
): Uint16Array => {
    const atomCount = order.length;
    const out = new Uint16Array(atomCount);
    for (let target = 0; target < atomCount; target++) {
        out[target] = source[order[target]];
    }
    return out;
};

export const reorderUint32 = (
    source: Uint32Array,
    order: Uint32Array
): Uint32Array => {
    const atomCount = order.length;
    const out = new Uint32Array(atomCount);
    for (let target = 0; target < atomCount; target++) {
        out[target] = source[order[target]];
    }
    return out;
};

export const reorderFloat32 = (
    source: Float32Array,
    order: Uint32Array
): Float32Array => {
    const atomCount = order.length;
    const out = new Float32Array(atomCount);
    for (let target = 0; target < atomCount; target++) {
        out[target] = source[order[target]];
    }
    return out;
};
