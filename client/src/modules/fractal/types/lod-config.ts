// Client mirror of the LOD spatial-streaming schema the daemon bakes
// (daemon `src/shared/octree`).
//
// The client mirrors the wire schema here as the single client-side source of
// truth (it depends only on bravais / expressions / voltclient). It MUST stay
// structurally identical to the daemon sidecar: the daemon bakes
// `<glbKey>.octree.json` next to the point-cloud GLB, and
// `octree-metadata-reader.ts` parses exactly this shape. If the daemon schema
// changes, this mirror changes with it.

export interface BoundsCell {
    minX: number;
    minY: number;
    minZ: number;
    maxX: number;
    maxY: number;
    maxZ: number;
}

// One node of the flat, level-ordered cells[] array (parent before children).
// `childIndices` indexes into the same array; null/undefined marks a leaf.
// `firstAtomIndex` + `atomCount` are a contiguous slice of the octree-ordered
// atom buffer, so a tile read is one contiguous range. In v1 the whole point
// cloud is one GLB and cells are index ranges into it — `glbKey` is absent.
export interface LODCell {
    bounds: BoundsCell;
    level: number;
    childIndices?: number[] | null;
    atomCount: number;
    firstAtomIndex: number;
    glbKey?: string;
    screenSpaceBudget?: number;
    valueMin?: number;
    valueMax?: number;
}

export interface FeatureBudget {
    maxGeometry: number;
    decimation?: number;
}

export interface GeometryBudget {
    maxTriangles: number;
    maxDrawCalls: number;
    perFeature: Record<string, FeatureBudget>;
}

export interface OctreeMetadata {
    version: 1;
    rootBounds: BoundsCell;
    maxDepth: number;
    cells: LODCell[];
    geometryBudget?: GeometryBudget;
}

// Client → server batch tile request. v1 has no per-cell GLB tiles (the cloud is
// one GLB), so this is the contract the fetcher will speak once per-cell tiles
// are baked; today the LOD manager selects index ranges into the single buffer.
export interface TileFetchRequest {
    analysisId: string;
    cellIndices: number[];
    priority?: 'immediate' | 'background';
}

// Built-in per-feature budgets, mirrored from the daemon's BUILT_IN_FEATURE_BUDGETS.
// Points scale to 100M+ as a raw buffer; glyphs and bonds are triangulated and
// decimate aggressively above their caps.
export const BUILT_IN_FEATURE_BUDGETS: Record<string, FeatureBudget> = {
    points: { maxGeometry: 100_000_000 },
    vectors: { maxGeometry: 2_000_000, decimation: 10 },
    bonds: { maxGeometry: 10_000_000, decimation: 5 },
    meshes: { maxGeometry: 1_000_000 }
};

export const DEFAULT_GEOMETRY_BUDGET: GeometryBudget = {
    maxTriangles: 1_000_000,
    maxDrawCalls: 100,
    perFeature: BUILT_IN_FEATURE_BUDGETS
};

// Client-side LOD streaming settings, stored in the scene config (plain JSON, so
// it is Zustand/Yjs-serializable). `enabled` gates the whole substrate: when
// false the existing Morton-decimation render path stays in charge (it is the
// fallback and is never removed).
export interface LODSettings {
    enabled: boolean;
    // adaptive = frustum + screen-space drives tier selection; manual = render a
    // fixed level the user picks.
    strategy: 'adaptive' | 'manual';
    // manual strategy: which octree level to render (0 = root / coarsest).
    currentLevel: number;
    // adaptive strategy: render cells whose projected size is at least this many
    // CSS pixels; smaller cells collapse to their parent.
    targetScreenSpaceSize: number;
    // Fraction of the view radius to prefetch tiles outside the frustum.
    preloadRadius: number;
    geometryBudgetMode: 'balanced' | 'quality' | 'performance';
}

export const DEFAULT_LOD_SETTINGS: LODSettings = {
    enabled: false,
    strategy: 'adaptive',
    currentLevel: 0,
    targetScreenSpaceSize: 64,
    preloadRadius: 0.25,
    geometryBudgetMode: 'balanced'
};
