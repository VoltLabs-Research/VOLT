import {
    BUILT_IN_FEATURE_BUDGETS,
    DEFAULT_GEOMETRY_BUDGET
} from '@/modules/fractal/types/lod-config';
import type { FeatureBudget, GeometryBudget } from '@/modules/fractal/types/lod-config';

// Per-feature geometry budget + decimation registry. The single client-side
// decision point both the LOD substrate (12) and the geometry-adding features
// (vector glyphs 09, bonds 13, instanced spheres 14) read so they decimate
// against the same caps the daemon bake assumed (those caps ride in the octree
// sidecar's `geometryBudget`). A feature asks "how much of my full geometry can
// I draw?" and gets back a decimation factor: 1 = draw everything, N = draw
// every Nth element.
//
// This is deliberately framework-free (no React, no Three.js) so any exporter,
// hook, or service can call it. A single shared instance is exported so feature
// budgets registered at app init are visible everywhere.
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

    // Replace the registry from a baked octree's `geometryBudget` so the client
    // honors the exact caps the analysis assumed. Falls back to built-ins for any
    // feature the bake did not name.
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

    // Returns the decimation factor (>= 1) needed to keep `fullGeometryCount`
    // elements of `featureName` within budget. 1 means everything fits. The
    // factor is ceil(count / cap) so element 0, factor, 2*factor, … survive and
    // the rendered count never exceeds the cap. A feature with no registered
    // budget is unconstrained (factor 1).
    evaluateDecimation(featureName: string, fullGeometryCount: number): number {
        if (fullGeometryCount <= 0) return 1;
        const budget = this.featureBudgets.get(featureName);
        if (!budget) return 1;
        // A feature-declared decimation floor (e.g. bonds always thin to 1/5 of
        // a fully bonded network) caps quality even below the count threshold.
        const floor = budget.decimation && budget.decimation > 1 ? budget.decimation : 1;
        if (fullGeometryCount <= budget.maxGeometry) return floor;
        return Math.max(floor, Math.ceil(fullGeometryCount / budget.maxGeometry));
    }

    // Whether a feature can draw its full geometry without decimation.
    isWithinBudget(featureName: string, fullGeometryCount: number): boolean {
        const budget = this.featureBudgets.get(featureName);
        if (!budget) return true;
        return fullGeometryCount <= budget.maxGeometry && (!budget.decimation || budget.decimation <= 1);
    }

    getGlobalBudget(): { maxTriangles: number; maxDrawCalls: number } {
        return { ...this.globalBudget };
    }
}

// Shared singleton: features register/query against one registry so a baked
// budget applied once (from the octree sidecar) is honored by every feature.
export const geometryBudgetManager = new GeometryBudgetManager();
