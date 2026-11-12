import * as THREE from 'three';
import type { PointCloudBlocks } from '@/modules/fractal/services/point-cloud-blocks';

/**
 * Draws a point cloud block by block (see point-cloud-blocks) and skips, every frame, the blocks
 * that cannot put a pixel on screen. What reaches the screen is exactly what drawing every atom
 * gives: a block is skipped only when all of its atoms are outside the view, cut away by a slice
 * plane or hidden by the mask, the same tests the GPU applies to each atom.
 *
 * The draw goes through the multi-draw path three.js uses for BatchedMesh, so any set of blocks is
 * a single draw call. That path is selected by `isBatchedMesh`, and it reads the ranges from the
 * `_multiDraw*` fields; nothing else of BatchedMesh is used.
 */

interface MultiDrawPoints extends THREE.Points {
    isBatchedMesh: true;
    colorTexture: null;
    _colorsTexture: null;
    _multiDrawStarts: Int32Array;
    _multiDrawCounts: Int32Array;
    _multiDrawCount: number;
}

interface BlocksResponse {
    id: number;
    blocks: PointCloudBlocks;
}

const BLOCKS_KEY = 'pointCloudBlocks';
const HIDDEN_BLOCKS_KEY = 'hiddenPointCloudBlocks';

let worker: Worker | null = null;
let nextRequestId = 0;
const pendingRequests = new Map<number, (blocks: PointCloudBlocks) => void>();

const getWorker = (): Worker => {
    if (worker) return worker;
    worker = new Worker(new URL('../workers/point-cloud-blocks.worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (event: MessageEvent<BlocksResponse>) => {
        const resolve = pendingRequests.get(event.data.id);
        pendingRequests.delete(event.data.id);
        resolve?.(event.data.blocks);
    };
    return worker;
};

const readBlocks = (geometry: THREE.BufferGeometry): PointCloudBlocks | null => (
    (geometry.userData[BLOCKS_KEY] as PointCloudBlocks | undefined) ?? null
);

/** Marks the blocks whose atoms the visibility attribute hides, all of them. */
export const refreshHiddenPointCloudBlocks = (points: THREE.Points): void => {
    const blocks = readBlocks(points.geometry);
    const visibility = points.geometry.getAttribute('aVisible');
    if (!blocks || !(visibility instanceof THREE.BufferAttribute)) {
        delete points.userData[HIDDEN_BLOCKS_KEY];
        return;
    }

    const visible = visibility.array as Uint8Array;
    const hidden = new Uint8Array(blocks.starts.length);
    let anyHidden = false;
    for (let block = 0; block < blocks.starts.length; block += 1) {
        const end = blocks.starts[block] + blocks.counts[block];
        let blockHidden = 1;
        for (let entry = blocks.starts[block]; entry < end; entry += 1) {
            if (visible[blocks.index[entry]] !== 0) {
                blockHidden = 0;
                break;
            }
        }
        hidden[block] = blockHidden;
        if (blockHidden) anyHidden = true;
    }
    if (anyHidden) points.userData[HIDDEN_BLOCKS_KEY] = hidden;
    else delete points.userData[HIDDEN_BLOCKS_KEY];
};

const applyBlocks = (points: THREE.Points, blocks: PointCloudBlocks): void => {
    const geometry = points.geometry;
    if (!readBlocks(geometry)) {
        geometry.userData[BLOCKS_KEY] = blocks;
        geometry.setIndex(new THREE.BufferAttribute(blocks.index, 1));
    }
    const target = points as MultiDrawPoints;
    target._multiDrawStarts = new Int32Array(blocks.starts.length);
    target._multiDrawCounts = new Int32Array(blocks.starts.length);
    refreshHiddenPointCloudBlocks(points);
};

/**
 * Prepares a point cloud for block drawing. Until its blocks are computed (in a worker, so the
 * first frame is not delayed) it is drawn whole; `onReady` is called once they are in place.
 */
export const enablePointCloudBlocks = (points: THREE.Points, onReady?: () => void): void => {
    const geometry = points.geometry;
    const position = geometry.getAttribute('position');
    const target = points as MultiDrawPoints;
    target.isBatchedMesh = true;
    target.colorTexture = null;
    target._colorsTexture = null;
    target._multiDrawStarts = new Int32Array(1);
    target._multiDrawCounts = new Int32Array(1);
    target._multiDrawCount = 0;
    points.frustumCulled = false;

    const existing = readBlocks(geometry);
    if (existing) {
        applyBlocks(points, existing);
        return;
    }
    // A glTF from elsewhere may list its points through an index of its own; it is drawn whole.
    if (geometry.index || !(position instanceof THREE.BufferAttribute) || !(position.array instanceof Float32Array)) {
        return;
    }

    let disposed = false;
    const onDispose = () => {
        disposed = true;
    };
    geometry.addEventListener('dispose', onDispose);

    const id = nextRequestId++;
    pendingRequests.set(id, (blocks) => {
        geometry.removeEventListener('dispose', onDispose);
        if (disposed || points.geometry !== geometry) return;
        applyBlocks(points, blocks);
        onReady?.();
    });
    const positions = position.array.slice(0, position.count * 3);
    getWorker().postMessage({ id, positions }, [positions.buffer]);
};

const frustum = new THREE.Frustum();
const viewProjection = new THREE.Matrix4();
const sphereCenter = new THREE.Vector3();
const viewCenter = new THREE.Vector3();

/**
 * How large the point shader draws an atom at view depth z: max(minPixels, pixelsAtUnitDepth / z)
 * pixels of the target, for either projection (point-cloud.vert).
 */
export interface SpriteSize {
    pixelsAtUnitDepth: number;
    minPixels: number;
    /** Target pixels per world unit at depth 1 (perspective) or at any depth (orthographic). */
    pixelsPerUnit: number;
    perspective: boolean;
}

/**
 * The farthest an atom's sprite reaches from its centre, in world units, for atoms whose view depth
 * lies between `nearest` and `farthest`.
 */
export const spriteReach = (size: SpriteSize, nearest: number, farthest: number): number => {
    if (size.perspective) {
        // pixels × depth / pixelsPerUnit is largest where the depth is.
        return Math.max(size.pixelsAtUnitDepth, size.minPixels * farthest) / size.pixelsPerUnit / 2;
    }
    if (nearest <= 0) return Infinity;
    return Math.max(size.minPixels, size.pixelsAtUnitDepth / nearest) / size.pixelsPerUnit / 2;
};

/** Leaves the points out of the draw that is about to happen. */
export const skipPointCloudDraw = (points: THREE.Points): void => {
    const target = points as MultiDrawPoints;
    if (target.isBatchedMesh) target._multiDrawCount = 0;
};

/**
 * Fills the multi-draw ranges with the blocks that can reach the screen this frame. Called right
 * before the points are drawn, with the camera and target of that draw.
 */
export const selectVisiblePointCloudBlocks = (
    points: THREE.Points,
    renderer: THREE.WebGLRenderer,
    camera: THREE.Camera,
    material: THREE.Material,
    size: SpriteSize
): void => {
    const target = points as MultiDrawPoints;
    if (!target.isBatchedMesh) return;
    const geometry = points.geometry;
    const blocks = readBlocks(geometry);

    viewProjection.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    frustum.setFromProjectionMatrix(viewProjection, camera.coordinateSystem, camera.reversedDepth);
    const planes = renderer.localClippingEnabled ? (material.clippingPlanes ?? []) : [];
    const matrix = points.matrixWorld;
    const scale = matrix.getMaxScaleOnAxis();

    const reachesScreen = (x: number, y: number, z: number, radius: number): boolean => {
        sphereCenter.set(x, y, z).applyMatrix4(matrix);
        const worldRadius = radius * scale;
        for (const plane of planes) {
            if (plane.distanceToPoint(sphereCenter) < -worldRadius) return false;
        }
        const depth = -viewCenter.copy(sphereCenter).applyMatrix4(camera.matrixWorldInverse).z;
        const reach = worldRadius + spriteReach(size, depth - worldRadius, depth + worldRadius);
        for (const plane of frustum.planes) {
            if (plane.distanceToPoint(sphereCenter) < -reach) return false;
        }
        return true;
    };

    if (!blocks) {
        const count = geometry.getAttribute('position')?.count ?? 0;
        const sphere = geometry.boundingSphere ?? (geometry.computeBoundingSphere(), geometry.boundingSphere);
        const whole = !sphere || reachesScreen(sphere.center.x, sphere.center.y, sphere.center.z, sphere.radius);
        target._multiDrawStarts[0] = 0;
        target._multiDrawCounts[0] = count;
        target._multiDrawCount = whole && count > 0 ? 1 : 0;
        return;
    }

    const hidden = points.userData[HIDDEN_BLOCKS_KEY] as Uint8Array | undefined;
    const { starts, counts, spheres } = blocks;
    const bytesPerIndex = 4;
    let ranges = 0;
    let runStart = -1;
    let runEnd = -1;
    for (let block = 0; block < starts.length; block += 1) {
        const visible = !hidden?.[block] && reachesScreen(
            spheres[block * 4],
            spheres[block * 4 + 1],
            spheres[block * 4 + 2],
            spheres[block * 4 + 3]
        );
        if (!visible) continue;
        if (starts[block] === runEnd) {
            runEnd += counts[block];
            continue;
        }
        if (runStart >= 0) {
            target._multiDrawStarts[ranges] = runStart * bytesPerIndex;
            target._multiDrawCounts[ranges] = runEnd - runStart;
            ranges += 1;
        }
        runStart = starts[block];
        runEnd = starts[block] + counts[block];
    }
    if (runStart >= 0) {
        target._multiDrawStarts[ranges] = runStart * bytesPerIndex;
        target._multiDrawCounts[ranges] = runEnd - runStart;
        ranges += 1;
    }
    target._multiDrawCount = ranges;
};
