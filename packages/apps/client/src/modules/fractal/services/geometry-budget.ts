interface FeatureBudget {
    maxGeometry: number;
    decimation?: number;
}

interface GeometryBudget {
    maxTriangles: number;
    maxDrawCalls: number;
    perFeature: Record<string, FeatureBudget>;
}

const BUILT_IN_FEATURE_BUDGETS: Record<string, FeatureBudget> = {
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

const DEFAULT_GEOMETRY_BUDGET: GeometryBudget = {
    maxTriangles: 1_000_000,
    maxDrawCalls: 100,
    perFeature: BUILT_IN_FEATURE_BUDGETS
};

class GeometryBudgetManager {
    private featureBudgets = new Map<string, FeatureBudget>();

    constructor(budget: GeometryBudget = DEFAULT_GEOMETRY_BUDGET) {
        this.applyBudget(budget);
    }

    applyBudget(budget: GeometryBudget): void {
        this.featureBudgets.clear();
        for (const [name, featureBudget] of Object.entries(BUILT_IN_FEATURE_BUDGETS)) {
            this.featureBudgets.set(name, featureBudget);
        }
        for (const [name, featureBudget] of Object.entries(budget.perFeature)) {
            this.featureBudgets.set(name, featureBudget);
        }
    }

    isWithinBudget(featureName: string, fullGeometryCount: number): boolean {
        const budget = this.featureBudgets.get(featureName);
        if (!budget) return true;
        return fullGeometryCount <= budget.maxGeometry && (!budget.decimation || budget.decimation <= 1);
    }
}

export const geometryBudgetManager = new GeometryBudgetManager();
