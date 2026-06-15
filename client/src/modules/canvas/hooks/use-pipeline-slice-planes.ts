import { useMemo } from 'react';
import { Plane } from 'three';
import { useShallow } from 'zustand/react/shallow';
import { useCanvasPipelineStore, collectEnabledSliceStages } from '@/modules/canvas/stores/canvas-pipeline';
import {
    DEFAULT_SLICE_PLANE_STAGE_CONFIG
} from '@/modules/canvas/stores/canvas-pipeline';
import {
    getSlicePlaneCenterDistance,
    resolveSlicePlaneDefinition
} from '@/modules/fractal/utilities/slice-plane';
import type { SlicePlaneStageConfig } from '@/modules/canvas/stores/canvas-pipeline';
import type { SlicePlaneConfig } from '@/modules/fractal/api/entities/scene';
import type { ModelWorldBounds } from '@/modules/fractal/api/entities/model';

const EMPTY_PLANES: Plane[] = [];

// A stage config is "pristine" (untouched defaults) → auto-center its distance on
// the model so a freshly-added slice lands in the middle instead of at the origin.
const isStageConfigPristine = (config: SlicePlaneStageConfig): boolean =>
    config.distance === DEFAULT_SLICE_PLANE_STAGE_CONFIG.distance
    && config.normal.x === DEFAULT_SLICE_PLANE_STAGE_CONFIG.normal.x
    && config.normal.y === DEFAULT_SLICE_PLANE_STAGE_CONFIG.normal.y
    && config.normal.z === DEFAULT_SLICE_PLANE_STAGE_CONFIG.normal.z
    && config.reverseOrientation === DEFAULT_SLICE_PLANE_STAGE_CONFIG.reverseOrientation;

// A stage config carries no `enabled` flag (the pipeline row's toggle gates it),
// so present it to the resolver as an enabled SlicePlaneConfig.
export const toSlicePlaneConfig = (
    config: SlicePlaneStageConfig,
    bounds?: ModelWorldBounds | null
): SlicePlaneConfig => {
    const base: SlicePlaneConfig = {
        enabled: true,
        distance: config.distance,
        normal: { ...config.normal },
        reverseOrientation: config.reverseOrientation,
        visualizePlane: config.visualizePlane
    };
    if (bounds && isStageConfigPristine(config)) {
        return { ...base, distance: getSlicePlaneCenterDistance(base, bounds) };
    }
    return base;
};

/**
 * Builds the combined clipping-plane array from every ENABLED slice-plane stage in
 * the active trajectory's pipeline. Three.js ANDs the planes (an atom must be on
 * the kept side of all of them), so N slice stages compose naturally.
 */
const usePipelineSlicePlanes = (
    trajectoryId: string | undefined,
    modelWorldBounds?: ModelWorldBounds | null
): Plane[] => {
    const stages = useCanvasPipelineStore(
        useShallow((state) => (trajectoryId ? state.byTrajectory[trajectoryId] : undefined))
    );

    return useMemo(() => {
        if (!stages) return EMPTY_PLANES;
        const sliceStages = collectEnabledSliceStages(stages);
        if (sliceStages.length === 0) return EMPTY_PLANES;

        const planes: Plane[] = [];
        for (const { config } of sliceStages) {
            const definition = resolveSlicePlaneDefinition(toSlicePlaneConfig(config, modelWorldBounds));
            if (definition) planes.push(definition.plane);
        }
        return planes.length > 0 ? planes : EMPTY_PLANES;
    }, [stages, modelWorldBounds]);
};

export default usePipelineSlicePlanes;
