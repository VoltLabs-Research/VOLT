// Why: int16-normalized position quantization (F5.S1). We store per-frame bbox
// and scale so the decoder can rehydrate float coordinates:
//
//   normalized = (pos - bboxMin) / (bboxMax - bboxMin)     in [0, 1]
//   stored     = round(normalized * 65535) - 32768         in [-32768, 32767]
//   decoded    = bboxMin + ((stored + 32768) / 65535) * (bboxMax - bboxMin)
//
// Error bound: ~span/65535 per axis (≈0.015% of bbox span), well below the
// 0.01% target referenced in the plan for typical atomistic simulations.

const UINT16_MAX = 65535;
const INT16_BIAS = 32768;

export const quantizePositionsInt16 = (
    positions: Float32Array,
    atomCount: number,
    bbox: readonly [number, number, number, number, number, number]
): Int16Ar  ray => {
    const out = new Int16Array(atomCount * 3);
    const spanX = bbox[3] - bbox[0];
    const spanY = bbox[4] - bbox[1];
    const spanZ = bbox[5] - bbox[2];
    const invSpan: [number, number, number] = [
        spanX > 0 ? UINT16_MAX / spanX : 0,
        spanY > 0 ? UINT16_MAX / spanY : 0,
        spanZ > 0 ? UINT16_MAX / spanZ : 0
    ];

    for (let index = 0; index < atomCount; index++) {
        const base = index * 3;
        for (let axis = 0; axis < 3; axis++) {
            const raw = positions[base + axis] - bbox[axis];
            let scaled = Math.round(raw * invSpan[axis]);
            if (scaled < 0) scaled = 0;
            if (scaled > UINT16_MAX) scaled = UINT16_MAX;
            out[base + axis] = scaled - INT16_BIAS;
        }
    }

    return out;
};

export const dequantizePositionsInt16 = (
    quantized: Int16Array,
    atomCount: number,
    bbox: readonly [number, number, number, number, number, number]
): Float32Array => {
    const out = new Float32Array(atomCount * 3);
    const spanX = bbox[3] - bbox[0];
    const spanY = bbox[4] - bbox[1];
    const spanZ = bbox[5] - bbox[2];
    const spans: [number, number, number] = [spanX, spanY, spanZ];

    for (let index = 0; index < atomCount; index++) {
        const base = index * 3;
        for (let axis = 0; axis < 3; axis++) {
            const normalized = (quantized[base + axis] + INT16_BIAS) / UINT16_MAX;
            out[base + axis] = bbox[axis] + normalized * spans[axis];
        }
    }

    return out;
};

export const computeBbox = (
    positions: Float32Array,
    atomCount: number
): [number, number, number, number, number, number] => {
    if (atomCount === 0) return [0, 0, 0, 0, 0, 0];
    let minX = positions[0];
    let minY = positions[1];
    let minZ = positions[2];
    let maxX = minX;
    let maxY = minY;
    let maxZ = minZ;

    for (let index = 1; index < atomCount; index++) {
        const base = index * 3;
        const x = positions[base];
        const y = positions[base + 1];
        const z = positions[base + 2];
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (z < minZ) minZ = z;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
        if (z > maxZ) maxZ = z;
    }

    return [minX, minY, minZ, maxX, maxY, maxZ];
};

export const unionBbox = (
    target: [number, number, number, number, number, number],
    source: readonly [number, number, number, number, number, number]
): void => {
    if (source[0] < target[0]) target[0] = source[0];
    if (source[1] < target[1]) target[1] = source[1];
    if (source[2] < target[2]) target[2] = source[2];
    if (source[3] > target[3]) target[3] = source[3];
    if (source[4] > target[4]) target[4] = source[4];
    if (source[5] > target[5]) target[5] = source[5];
};
