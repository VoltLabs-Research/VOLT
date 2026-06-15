import { geometryBudgetManager } from '@/modules/fractal/services/geometry-budget';

import type { LineSceneSettings } from '@/modules/fractal/types/scene-config';

// Bond rendering helpers (pure; no React, no Three.js).
//
// A bond is baked by the daemon BondExporter as a cylinder through the exact
// line-tube path dislocation lines use (bond-exporter.ts delegates to the line
// exporter), so a bonds GLB is mechanically a line-tube mesh GLB with a
// `.ranges.json` sidecar. That means the existing GLB/mesh render path in the
// fractal engine renders bonds with no new shader — bonds reuse the line tube's
// `updateLineWidth` vertex-offset path. These helpers map a bond exposure's
// baked radius to the engine's `LineSceneSettings` and gate rendering by bond
// count, mirroring `shouldRenderSpheres` in geometry-pool.ts (plan 14).

// The exporter name the daemon stamps on a bond exposure's export metadata
// (ExportNodeProcessor 'BondExporter' case). The client recognizes a bonds scene
// by this value on `sceneRenderMetadata.exporter`.
export const BOND_EXPORTER_NAME = 'BondExporter';

// Matches the daemon BondExporter default (0.15 Å radius → 0.30 Å diameter,
// OVITO's default bond width). The baked tube already carries this radius in its
// geometry; the engine offsets from it when the user overrides the width.
export const DEFAULT_BOND_RADIUS = 0.15;

// Above this bond count the client declines to mount the tube mesh and the
// caller should fall back to a lighter representation (or skip bonds), the same
// way `SPHERE_RENDER_ATOM_THRESHOLD` gates real spheres. A fully bonded network
// (e.g. C diamond at ~12 bonds/atom over a large cell) triangulates to tens of
// millions of cylinder vertices — past this the WebGL buffer / frame rate cliff
// is not worth it. Tunable; bonds stay smooth well into the low millions.
export const BOND_RENDER_COUNT_THRESHOLD = 2_000_000;

export interface BondRenderMetadata {
    // Per-bond cylinder radius the exposure was baked with (export option), if
    // declared. Falls back to DEFAULT_BOND_RADIUS.
    radius?: number;
}

// Whether the bond tube mesh should render for `bondCount` bonds, or the caller
// should skip it. Combines the hard count threshold with the shared geometry
// budget (`bonds` feature cap) so a bake that declared a tighter budget is
// honored. Mirrors `shouldRenderSpheres`.
export const shouldRenderBonds = (bondCount: number): boolean => {
    if (bondCount <= 0) return false;
    if (bondCount > BOND_RENDER_COUNT_THRESHOLD) return false;
    return geometryBudgetManager.isWithinBudget('bonds', bondCount);
};

// The decimation factor the geometry budget recommends for `bondCount` bonds
// (>= 1). The client cannot decimate an already-baked tube GLB, so this is
// advisory — exposed for the bake/daemon path and for diagnostics — but it lets
// a caller decide to skip rendering when the factor is large.
export const bondDecimationFactor = (bondCount: number): number =>
    geometryBudgetManager.evaluateDecimation('bonds', bondCount);

// Map a bond exposure's baked radius (+ optional user width override) to the
// engine's LineSceneSettings. `baseLineWidth` is the baked diameter (radius * 2)
// the tube geometry already has; `lineWidth` is what the user wants — equal to
// the base unless overridden, so `updateLineWidth` offsets vertices to the new
// width in-frame. Returns undefined when there is nothing to render.
export const resolveBondLineSettings = (
    metadata: BondRenderMetadata | undefined,
    widthOverride?: number
): LineSceneSettings => {
    const radius = metadata?.radius && metadata.radius > 0 ? metadata.radius : DEFAULT_BOND_RADIUS;
    const baseLineWidth = radius * 2;
    const lineWidth = widthOverride && widthOverride > 0 ? widthOverride : baseLineWidth;
    return { baseLineWidth, lineWidth };
};
