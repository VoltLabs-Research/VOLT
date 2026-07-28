import { useMemo } from 'react';
import { Plane } from 'three';
import { useShallow } from 'zustand/react/shallow';
import { useCanvasPipelineStore, collectEnabledSliceStages } from '@/modules/canvas/store/canvas-pipeline';
import {
    DEFAULT_SLICE_PLANE_STAGE_CONFIG
} from '@/modules/canvas/store/canvas-pipeline';
import {
    getSlicePlaneCenterDistance,
    resolveSlicePlaneDefinition
} from '@/modules/fractal/utils/slice-plane';
import type { SlicePlaneStageConfig } from '@/modules/canvas/store/canvas-pipeline';
import type { SlicePlaneConfig } from '@/modules/fractal/contracts/scene';
import type { ModelWorldBounds } from '@/modules/fractal/contracts/model';

const EMPTY_PLANES: Plane[] = [];

const isStageConfigPristine = (config: SlicePlaneStageConfig): boolean =>
    config.distance === DEFAULT_SLICE_PLANE_STAGE_CONFIG.distance
    && config.normal.x === DEFAULT_SLICE_PLANE_STAGE_CONFIG.normal.x
    && config.normal.y === DEFAULT_SLICE_PLANE_STAGE_CONFIG.normal.y
    && config.normal.z === DEFAULT_SLICE_PLANE_STAGE_CONFIG.normal.z
    && config.reverseOrientation === DEFAULT_SLICE_PLANE_STAGE_CONFIG.reverseOrientation;

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
        return {
            ...base,
            distance: getSlicePlaneCenterDistance(base, bounds)
        };
    }
    return base;
};

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
