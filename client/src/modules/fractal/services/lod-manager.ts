import * as THREE from 'three';
import { geometryBudgetManager } from '@/modules/fractal/services/geometry-budget';

import type { LODCell, LODSettings, OctreeMetadata, TileFetchRequest } from '@/modules/fractal/contracts/lod-config';

const WORLD_BOX = new THREE.Box3();
const WORLD_SPHERE = new THREE.Sphere();
const TMP_VEC = new THREE.Vector3();

export interface LODSelection {
    cells: LODCell[];
    cellIndices: number[];
    atomRanges: Array<{ start: number; count: number }>;
}

export class LODManager {
    private octree: OctreeMetadata;
    private viewport: { width: number; height: number };
    private camera: THREE.Camera;
    private cachedCells = new Set<number>();
    private readonly frustum = new THREE.Frustum();
    private readonly projScreenMatrix = new THREE.Matrix4();

    constructor(octree: OctreeMetadata, viewport: { width: number; height: number }, camera: THREE.Camera) {
        this.octree = octree;
        this.viewport = viewport;
        this.camera = camera;
        if (octree.geometryBudget) {
            geometryBudgetManager.applyBudget(octree.geometryBudget);
        }
    }

    setCamera(camera: THREE.Camera): void {
        this.camera = camera;
    }

    setViewport(viewport: { width: number; height: number }): void {
        this.viewport = viewport;
    }

    markCached(cellIndex: number): void {
        this.cachedCells.add(cellIndex);
    }

    isCached(cellIndex: number): boolean {
        return this.cachedCells.has(cellIndex);
    }

    getOctree(): OctreeMetadata {
        return this.octree;
    }

    private updateFrustum(): void {
        this.projScreenMatrix.multiplyMatrices(
            this.camera.projectionMatrix,
            this.camera.matrixWorldInverse
        );
        this.frustum.setFromProjectionMatrix(this.projScreenMatrix);
    }

    intersectsFrustum(cell: LODCell): boolean {
        const { bounds } = cell;
        WORLD_BOX.min.set(bounds.minX, bounds.minY, bounds.minZ);
        WORLD_BOX.max.set(bounds.maxX, bounds.maxY, bounds.maxZ);
        return this.frustum.intersectsBox(WORLD_BOX);
    }

    estimateScreenSpaceSizePixels(cell: LODCell): number {
        const { bounds } = cell;
        WORLD_BOX.min.set(bounds.minX, bounds.minY, bounds.minZ);
        WORLD_BOX.max.set(bounds.maxX, bounds.maxY, bounds.maxZ);
        WORLD_BOX.getBoundingSphere(WORLD_SPHERE);
        const radius = WORLD_SPHERE.radius;
        if (radius <= 0) return 0;

        if (!(this.camera instanceof THREE.PerspectiveCamera)) {
            return Number.POSITIVE_INFINITY;
        }

        this.camera.getWorldPosition(TMP_VEC);
        const distance = TMP_VEC.distanceTo(WORLD_SPHERE.center);
        if (distance <= radius) {
            return Number.POSITIVE_INFINITY;
        }
        const fovRad = (this.camera.fov * Math.PI) / 180;
        const projected = (radius / distance) * (this.viewport.height / (2 * Math.tan(fovRad / 2)));
        return projected * 2;
    }

    selectLODTiles(settings: LODSettings): LODSelection {
        this.updateFrustum();
        const cells = this.octree.cells;
        const selected: LODCell[] = [];
        const selectedIndices: number[] = [];
        if (cells.length === 0) {
            return { cells: selected, cellIndices: selectedIndices, atomRanges: [] };
        }

        const targetLevel = settings.strategy === 'manual'
            ? Math.max(0, Math.min(settings.currentLevel, this.octree.maxDepth))
            : -1;

        const stack: number[] = [0];
        while (stack.length > 0) {
            const index = stack.pop()!;
            const cell = cells[index];
            if (!cell) continue;
            if (!this.intersectsFrustum(cell)) continue;

            const isLeaf = !cell.childIndices || cell.childIndices.length === 0;
            const stopHere = settings.strategy === 'manual'
                ? cell.level >= targetLevel || isLeaf
                : isLeaf || this.estimateScreenSpaceSizePixels(cell) <= settings.targetScreenSpaceSize;

            if (stopHere) {
                selected.push(cell);
                selectedIndices.push(index);
                continue;
            }
            for (const childIndex of cell.childIndices!) stack.push(childIndex);
        }

        return {
            cells: selected,
            cellIndices: selectedIndices,
            atomRanges: mergeAtomRanges(selected)
        };
    }

    requestTiles(analysisId: string, selection: LODSelection): TileFetchRequest | null {
        const cellIndices: number[] = [];
        for (let i = 0; i < selection.cells.length; i += 1) {
            const cell = selection.cells[i];
            const cellIndex = selection.cellIndices[i];
            if (!cell.glbKey) continue;
            if (this.cachedCells.has(cellIndex)) continue;
            cellIndices.push(cellIndex);
        }
        if (cellIndices.length === 0) return null;
        return { analysisId, cellIndices, priority: 'immediate' };
    }
}

const mergeAtomRanges = (cells: LODCell[]): Array<{ start: number; count: number }> => {
    const ranges = cells
        .map((cell) => ({ start: cell.firstAtomIndex, count: cell.atomCount }))
        .filter((range) => range.count > 0)
        .sort((a, b) => a.start - b.start);
    if (ranges.length === 0) return [];

    const merged: Array<{ start: number; count: number }> = [ranges[0]];
    for (let i = 1; i < ranges.length; i += 1) {
        const last = merged[merged.length - 1];
        const range = ranges[i];
        if (range.start <= last.start + last.count) {
            const end = Math.max(last.start + last.count, range.start + range.count);
            last.count = end - last.start;
        } else {
            merged.push(range);
        }
    }
    return merged;
};
