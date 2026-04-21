import {
    buildPermutation,
    computeBoundingBox,
    computeMortonCodes
} from '@/modules/fractal/utilities/morton-sort';

interface MortonSortRequest {
    type: 'morton-sort';
    id: number;
    positions: Float32Array;
}

interface MortonSortResponse {
    type: 'morton-sort-result';
    id: number;
    permutation: Uint32Array;
}

self.addEventListener('message', (event: MessageEvent<MortonSortRequest>) => {
    const data = event.data;
    if (!data || data.type !== 'morton-sort') return;

    const bbox = computeBoundingBox(data.positions);
    const codes = computeMortonCodes(data.positions, bbox);
    const permutation = buildPermutation(codes);

    const response: MortonSortResponse = {
        type: 'morton-sort-result',
        id: data.id,
        permutation
    };

    (self as unknown as DedicatedWorkerGlobalScope).postMessage(response, [permutation.buffer]);
});

export {};
