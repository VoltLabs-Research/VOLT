import {
    BUILT_IN_FEATURE_BUDGETS,
    DEFAULT_GEOMETRY_BUDGET
} from '@/modules/fractal/contracts/lod-config';
import type { FeatureBudget, GeometryBudget } from '@/modules/fractal/contracts/lod-config';

export class GeometryBudgetManager {
    private featureBudgets = new Map<string, FeatureBudget>();
    private globalBudget: { maxTriangles: number; maxDrawCalls: number };

    constructor(budget: GeometryBudget = DEFAULT_GEOMETRY_BUDGET) {
        this.applyBudget(budget);
        this.globalBudget = {
            maxTriangles: budget.maxTriangles,
            maxDrawCalls: budget.maxDrawCalls
        };
    }

    applyBudget(budget: GeometryBudget): void {
        this.featureBudgets.clear();
        for (const [name, featureBudget] of Object.entries(BUILT_IN_FEATURE_BUDGETS)) {
            this.featureBudgets.set(name, featureBudget);
        }
        for (const [name, featureBudget] of Object.entries(budget.perFeature)) {
            this.featureBudgets.set(name, featureBudget);
        }
        this.globalBudget = {
            maxTriangles: budget.maxTriangles,
            maxDrawCalls: budget.maxDrawCalls
        };
    }

    registerFeature(name: string, budget: FeatureBudget): void {
        this.featureBudgets.set(name, budget);
    }

    getFeatureBudget(name: string): FeatureBudget | undefined {
        return this.featureBudgets.get(name);
    }

    evaluateDecimation(featureName: string, fullGeometryCount: number): number {
        if (fullGeometryCount <= 0) return 1;
        const budget = this.featureBudgets.get(featureName);
        if (!budget) return 1;
        const floor = budget.decimation && budget.decimation > 1 ? budget.decimation : 1;
        if (fullGeometryCount <= budget.maxGeometry) return floor;
        return Math.max(floor, Math.ceil(fullGeometryCount / budget.maxGeometry));
    }

    isWithinBudget(featureName: string, fullGeometryCount: number): boolean {
        const budget = this.featureBudgets.get(featureName);
        if (!budget) return true;
        return fullGeometryCount <= budget.maxGeometry && (!budget.decimation || budget.decimation <= 1);
    }

    getGlobalBudget(): { maxTriangles: number; maxDrawCalls: number } {
        return { ...this.globalBudget };
    }
}

export const geometryBudgetManager = new GeometryBudgetManager();
