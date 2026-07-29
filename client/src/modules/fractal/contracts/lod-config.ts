
export interface FeatureBudget {
    maxGeometry: number;
    decimation?: number;
}

export interface GeometryBudget {
    maxTriangles: number;
    maxDrawCalls: number;
    perFeature: Record<string, FeatureBudget>;
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

