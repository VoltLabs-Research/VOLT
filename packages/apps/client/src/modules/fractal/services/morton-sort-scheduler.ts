import * as THREE from 'three';
import MortonSortWorker from '@/modules/fractal/workers/morton-sort.worker?worker';
import type { MortonAttributePayload } from '@/modules/fractal/contracts/engine';

interface MortonSortResult {
    id: number;
    permutation: Uint32Array;
    positions: Float32Array;
    attributes: MortonAttributePayload[];
}

const REORDERABLE_ATTRIBUTE_NAMES = ['iRadius', '_color_index'];

const reorderAttributeInPlace = (attribute: THREE.BufferAttribute, permutation: Uint32Array): void => {
    const source = attribute.array as Float32Array;
    const itemSize = attribute.itemSize;
    const count = permutation.length;
    const reordered = new Float32Array(count * itemSize);
    for (let index = 0; index < count; index += 1) {
        const src = permutation[index] * itemSize;
        const dst = index * itemSize;
        for (let k = 0; k < itemSize; k += 1) {
            reordered[dst + k] = source[src + k];
        }
    }
    attribute.array = reordered;
    attribute.needsUpdate = true;
};

const applySortResult = (points: THREE.Points, result: MortonSortResult): void => {
    const permutation = result.permutation;

    const positionAttribute = points.geometry.getAttribute('position');
    if (positionAttribute instanceof THREE.BufferAttribute && positionAttribute.count === permutation.length) {
        positionAttribute.array = result.positions;
        positionAttribute.needsUpdate = true;
    }

    for (const attribute of result.attributes) {
        const target = points.geometry.getAttribute(attribute.name);
        if (target instanceof THREE.BufferAttribute && target.count === permutation.length) {
            target.array = attribute.array;
            target.needsUpdate = true;
        }
    }

    const colorAttribute = points.geometry.getAttribute('color');
    if (colorAttribute instanceof THREE.BufferAttribute && colorAttribute.count === permutation.length) {
        reorderAttributeInPlace(colorAttribute, permutation);
    }

    points.geometry.computeBoundingBox();
    points.geometry.computeBoundingSphere();
};

export class MortonSortScheduler {
    private worker: Worker | null = null;
    private currentRequestId = 0;

    schedule(points: THREE.Points, onSorted: (permutation: Uint32Array) => void): void {
        const position = points.geometry.getAttribute('position');
        if (!(position instanceof THREE.BufferAttribute)) return;

        const positions = new Float32Array(position.array as Float32Array);
        const attributes: MortonAttributePayload[] = [];
        for (const name of REORDERABLE_ATTRIBUTE_NAMES) {
            const attribute = points.geometry.getAttribute(name);
            if (attribute instanceof THREE.BufferAttribute && attribute.count === position.count) {
                attributes.push({
                    name,
                    itemSize: attribute.itemSize,
                    array: new Float32Array(attribute.array as Float32Array)
                });
            }
        }

        if (!this.worker) {
            this.worker = new MortonSortWorker();
        }
        const worker = this.worker;
        const requestId = ++this.currentRequestId;

        const handleMessage = (event: MessageEvent<MortonSortResult>) => {
            if (event.data.id !== requestId) return;
            worker.removeEventListener('message', handleMessage);
            if (this.currentRequestId !== requestId) return;
            applySortResult(points, event.data);
            onSorted(event.data.permutation);
        };
        worker.addEventListener('message', handleMessage);

        worker.postMessage({
            type: 'morton-sort',
            id: requestId,
            positions,
            attributes
        }, [
            positions.buffer,
            ...attributes.map((attribute) => attribute.array.buffer)
        ]);
    }

    dispose(): void {
        this.currentRequestId += 1;
        this.worker?.terminate();
        this.worker = null;
    }
}
