// Why: delta-encode quantized int16 positions against the previous keyframe.
// We pick int8 per-axis if every delta fits; otherwise fall back to int16. The
// reader reconstructs by summing the keyframe's int16 values with the delta.

export type DeltaPayload =
    | { kind: 'int8'; data: Int8Array }
    | { kind: 'int16'; data: Int16Array };

export const encodeDelta = (
    current: Int16Array,
    reference: Int16Array
): DeltaPayload => {
    if (current.length !== reference.length) {
        throw new Error(`delta length mismatch: current=${current.length} reference=${reference.length}`);
    }
    const length = current.length;
    const delta = new Int16Array(length);
    let fitsInt8 = true;
    for (let index = 0; index < length; index++) {
        const diff = current[index] - reference[index];
        delta[index] = diff;
        if (diff < -128 || diff > 127) {
            fitsInt8 = false;
        }
    }

    if (fitsInt8) {
        const packed = new Int8Array(length);
        for (let index = 0; index < length; index++) {
            packed[index] = delta[index];
        }
        return { kind: 'int8', data: packed };
    }

    return { kind: 'int16', data: delta };
};

export const applyDeltaInt8 = (
    reference: Int16Array,
    delta: Int8Array
): Int16Array => {
    if (reference.length !== delta.length) {
        throw new Error(`delta apply length mismatch: reference=${reference.length} delta=${delta.length}`);
    }
    const out = new Int16Array(reference.length);
    for (let index = 0; index < reference.length; index++) {
        out[index] = reference[index] + delta[index];
    }
    return out;
};

export const applyDeltaInt16 = (
    reference: Int16Array,
    delta: Int16Array
): Int16Array => {
    if (reference.length !== delta.length) {
        throw new Error(`delta apply length mismatch: reference=${reference.length} delta=${delta.length}`);
    }
    const out = new Int16Array(reference.length);
    for (let index = 0; index < reference.length; index++) {
        out[index] = reference[index] + delta[index];
    }
    return out;
};
