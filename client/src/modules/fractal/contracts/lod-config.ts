
export interface BoundsCell {
    minX: number;
    minY: number;
    minZ: number;
    maxX: number;
    maxY: number;
    maxZ: number;
}

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

export interface TileFetchRequest {
    analysisId: string;
    cellIndices: number[];
    priority?: 'immediate' | 'background';
}

export const BUILT_IN_FEATURE_BUDGETS: Record<string, FeatureBudget> = {
    points: { maxGeometry: 100_000_000 },
    vectors: {
        maxGeometry: 2_000_000,
        decimation: 10
    },
    bonds: {
        maxGeometry: 10_000_000,
        decimation: 5
    },
    meshes: { maxGeometry: 1_000_000 }
};

export const DEFAULT_GEOMETRY_BUDGET: GeometryBudget = {
    maxTriangles: 1_000_000,
    maxDrawCalls: 100,
    perFeature: BUILT_IN_FEATURE_BUDGETS
};

export interface LODSettings {
    enabled: boolean;
    strategy: 'adaptive' | 'manual';
    currentLevel: number;
    targetScreenSpaceSize: number;
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
