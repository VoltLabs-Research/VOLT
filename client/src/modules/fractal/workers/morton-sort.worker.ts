import {
    buildPermutation,
    computeBoundingBox,
    computeMortonCodes
} from '@/modules/fractal/utilities/morton-sort';

interface MortonAttributePayload {
    name: string;
    itemSize: number;
    array: Float32Array;
}

interface MortonSortRequest {
    type: 'morton-sort';
    id: number;
    positions: Float32Array;
    attributes: MortonAttributePayload[];
}

interface MortonSortResponse {
    type: 'morton-sort-result';
    id: number;
    permutation: Uint32Array;
    positions: Float32Array;
    attributes: MortonAttributePayload[];
}

// Gather-by-index reorder of a flat interleaved attribute buffer. Always emits a
// Float32Array, matching the main-thread reorder this offloads (which allocated a
// fresh Float32Array regardless of source type).
const gatherAttribute = (source: Float32Array, itemSize: number, permutation: Uint32Array): Float32Array => {
    const count = permutation.length;
    const reordered = new Float32Array(count * itemSize);
    for (let i = 0; i < count; i += 1) {
        const src = permutation[i] * itemSize;
        const dst = i * itemSize;
        for (let k = 0; k < itemSize; k += 1) {
            reordered[dst + k] = source[src + k];
        }
    }
    return reordered;
};

self.addEventListener('message', (event: MessageEvent<MortonSortRequest>) => {
    const data = event.data;
    if (!data || data.type !== 'morton-sort') return;

    const bbox = computeBoundingBox(data.positions);
    const codes = computeMortonCodes(data.positions, bbox);
    const permutation = buildPermutation(codes);

    // Reorder positions (itemSize 3) and every supplied attribute in the worker so
    // the main thread only swaps `attribute.array` references after the sort.
    const reorderedPositions = gatherAttribute(data.positions, 3, permutation);
    const reorderedAttributes: MortonAttributePayload[] = data.attributes.map((attribute) => ({
        name: attribute.name,
        itemSize: attribute.itemSize,
        array: gatherAttribute(attribute.array, attribute.itemSize, permutation)
    }));

    const response: MortonSortResponse = {
        type: 'morton-sort-result',
        id: data.id,
        permutation,
        positions: reorderedPositions,
        attributes: reorderedAttributes
    };

    const transfer: Transferable[] = [
        permutation.buffer,
        reorderedPositions.buffer,
        ...reorderedAttributes.map((attribute) => attribute.array.buffer)
    ];
    (self as unknown as DedicatedWorkerGlobalScope).postMessage(response, transfer);
});

export {};
