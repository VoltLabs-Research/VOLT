import { useMemo } from 'react';
import SingleModelViewer from '@/modules/fractal/components/molecules/SingleModelViewer';
import { resolveBondLineSettings, shouldRenderBonds } from '@/modules/fractal/services/bond-render';
import { warnFractal } from '@/modules/fractal/utilities/debug-log';

import type { ComponentProps, FC } from 'react';

// Fractal bond primitive. A bonds exposure bakes to a cylinder GLB through the
// daemon BondExporter — mechanically a line-tube mesh with a `.ranges.json`
// sidecar (bond-exporter.ts delegates to the line exporter). So a bond scene is
// rendered by the same GLB/line path SingleModelViewer already drives; this
// primitive only adds the two bond-specific concerns:
//
//   1. Width: map the baked bond radius to the engine's LineSceneSettings so
//      `updateLineWidth` offsets to a user override in-frame (the baked tube
//      already carries the default width, so this is a no-op until overridden).
//   2. Scale-awareness: gate mounting by bond count via `shouldRenderBonds`
//      (the geometry-budget `bonds` cap + a hard threshold), the same pattern as
//      `shouldRenderSpheres` in plan 14. Above the cap the primitive renders
//      nothing rather than stalling the GPU on a dense bonded network.
//
// It is a thin wrapper, not a parallel renderer: everything heavy (GLB load,
// material, tube picking) stays in SingleModelViewer.

type BondsModelViewerProps = ComponentProps<typeof SingleModelViewer> & {
    // Number of bonds in the exposure (from the bonds payload / exposure stats).
    // Drives the scale-aware render gate. Omit/0 to always attempt rendering.
    bondCount?: number;
    // Per-bond cylinder radius the exposure was baked with (export option).
    bondRadius?: number;
    // User width override (Å), e.g. from a future View-stack bond-radius chip.
    bondWidthOverride?: number;
};

const BondsModelViewer: FC<BondsModelViewerProps> = ({
    bondCount,
    bondRadius,
    bondWidthOverride,
    lineSettings,
    ...singleModelViewerProps
}) => {
    const resolvedLineSettings = useMemo(
        () => lineSettings ?? resolveBondLineSettings({ radius: bondRadius }, bondWidthOverride),
        [lineSettings, bondRadius, bondWidthOverride]
    );

    const count = bondCount ?? 0;
    // 0 = count unknown (always render); a positive count is gated.
    const canRender = count === 0 || shouldRenderBonds(count);

    if (!canRender) {
        warnFractal('bonds.render-skipped-over-budget', {
            bondCount: count,
            sceneKey: singleModelViewerProps.sceneConfig
                ? `${singleModelViewerProps.sceneConfig.source}`
                : undefined
        });
        return null;
    }

    return (
        <SingleModelViewer
            {...singleModelViewerProps}
            lineSettings={resolvedLineSettings}
        />
    );
};

export default BondsModelViewer;
