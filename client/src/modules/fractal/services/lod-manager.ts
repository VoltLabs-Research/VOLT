import * as THREE from 'three';
import { geometryBudgetManager } from '@/modules/fractal/services/geometry-budget';

import type { LODCell, LODSettings, OctreeMetadata, TileFetchRequest } from '@/modules/fractal/types/lod-config';

// LODManager — octree navigation + screen-space tier selection + visible-region
// tile selection. Pure (no React); the hook (use-lod-streaming) owns its
// lifecycle and the engine reads its output.
//
// The manager walks the flat, level-ordered cells[] the daemon baked (parent
// before children; childIndices index into the same array). For each frame it:
//   1. Descends from the root, keeping any cell that intersects the frustum.
//   2. Stops descending into a cell once its projected screen-space size is at or
//      below the target budget (adaptive) or once it reaches the chosen level
//      (manual) — that cell is a render tier; its children are skipped.
//   3. Returns the selected leaf-ish cells + a fetch request for those not yet
//      cached.
//
// v1 octrees carry no per-cell GLB (`glbKey` absent) — the whole cloud is one
// GLB and cells are index ranges. So selection produces index ranges the engine
// could draw-range against; the per-cell tile fetch is the forward slot for when
// the daemon bakes per-cell GLBs. The manager already speaks both: a cell with a
// `glbKey` becomes a fetch target, one without is an index range.

const WORLD_BOX = new THREE.Box3();
const WORLD_SPHERE = new THREE.Sphere();
const TMP_VEC = new THREE.Vector3();

export interface LODSelection {
    // Cells chosen to render this frame (the visible tier set).
    cells: LODCell[];
    // Their indices into octree.cells, for cache + fetch bookkeeping.
    cellIndices: number[];
    // Contiguous [firstAtomIndex, atomCount] ranges into the octree-ordered atom
    // buffer for the selected cells, merged where adjacent. The engine can draw
    // only these ranges of the single-GLB point cloud (v1 path).
    atomRanges: Array<{ start: number; count: number }>;
}

export class LODManager {
    private octree: OctreeMetadata;
    private viewport: { width: number; height: number };
    private camera: THREE.Camera;
    // Cells whose geometry the fetcher has already cached (by cell index). v1
    // never populates this (single GLB), but the fetch/cache contract is here for
    // per-cell tiles.
    private cachedCells = new Set<number>();
    private readonly frustum = new THREE.Frustum();
    private readonly projScreenMatrix = new THREE.Matrix4();

    constructor(octree: OctreeMetadata, viewport: { width: number; height: number }, camera: THREE.Camera) {
        this.octree = octree;
        this.viewport = viewport;
        this.camera = camera;
        if (octree.geometryBudget) {
            // Honor the caps the bake assumed across all geometry features.
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

    // Refresh the cached frustum from the current camera. Called once per
    // selection so every cell test reads a consistent frustum.
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

    // Estimated projected size of a cell's bounding sphere, in CSS pixels. Uses
    // the perspective relation size_px ≈ (radius / dist) * (viewportHeight /
    // (2 tan(fov/2))). For a non-perspective camera, falls back to a large value
    // so adaptive selection renders the cell (it cannot LOD on distance).
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
            // Camera inside the cell — treat as maximally large so we descend.
            return Number.POSITIVE_INFINITY;
        }
        const fovRad = (this.camera.fov * Math.PI) / 180;
        const projected = (radius / distance) * (this.viewport.height / (2 * Math.tan(fovRad / 2)));
        // Diameter in pixels.
        return projected * 2;
    }

    // Select the render tier set for the current camera + settings. Adaptive:
    // descend until a cell is small enough (screen-space ≤ target) or is a leaf.
    // Manual: render every frustum-intersecting cell at exactly settings.currentLevel
    // (clamped to maxDepth).
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

        // Iterative descent from the root (cell 0).
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

    // Build a fetch request for selected cells that carry a per-cell GLB and are
    // not yet cached. Returns null when nothing needs fetching (the v1 single-GLB
    // case, or all tiles cached).
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

// Merge selected cells' [firstAtomIndex, atomCount) into ascending, coalesced
// ranges so the engine draws contiguous slices of the octree-ordered buffer.
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
