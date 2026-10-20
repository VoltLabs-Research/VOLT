import { geometryBudgetManager } from '@/modules/fractal/services/geometry-budget';

import type { LineSceneSettings } from '@/modules/fractal/contracts/scene-config';

const DEFAULT_BOND_RADIUS = 0.15;

const BOND_RENDER_COUNT_THRESHOLD = 2_000_000;

interface BondRenderMetadata {
    radius?: number;
}

export const shouldRenderBonds = (bondCount: number): boolean => {
    if (bondCount <= 0) return false;
    if (bondCount > BOND_RENDER_COUNT_THRESHOLD) return false;
    return geometryBudgetManager.isWithinBudget('bonds', bondCount);
};

export const resolveBondLineSettings = (
    metadata: BondRenderMetadata | undefined,
    widthOverride?: number
): LineSceneSettings => {
    const radius = metadata?.radius && metadata.radius > 0 ? metadata.radius : DEFAULT_BOND_RADIUS;
    const baseLineWidth = radius * 2;
    const lineWidth = widthOverride && widthOverride > 0 ? widthOverride : baseLineWidth;
    return {
        baseLineWidth,
        lineWidth
    };
};
