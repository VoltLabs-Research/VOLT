import { useMemo } from 'react';
import SlicePlaneHelper from '@/modules/fractal/components/atoms/SlicePlaneHelper';
import { useActiveTrajectoryStages, collectEnabledSliceStages } from '@/modules/canvas/stores/canvas-pipeline';
import { toSlicePlaneConfig } from '@/modules/canvas/hooks/use-pipeline-slice-planes';
import type { ModelWorldBounds } from '@/modules/fractal/api/types/model';
import type { FC } from 'react';

interface PipelineSlicePlaneHelpersProps {
    modelWorldBounds?: ModelWorldBounds | null;
}

/**
 * Renders one SlicePlaneHelper gizmo per enabled slice-plane stage (whose
 * `visualizePlane` is on) in the active trajectory's pipeline. Reads the pipeline
 * store directly so the scene pipeline doesn't need new props threaded through it.
 */
const PipelineSlicePlaneHelpers: FC<PipelineSlicePlaneHelpersProps> = ({ modelWorldBounds }) => {
    const stages = useActiveTrajectoryStages();

    const sliceConfigs = useMemo(
        () => collectEnabledSliceStages(stages).map((entry) => ({
            id: entry.id,
            config: toSlicePlaneConfig(entry.config, modelWorldBounds)
        })),
        [stages, modelWorldBounds]
    );

    return (
        <>
            {sliceConfigs.map(({ id, config }) => (
                <SlicePlaneHelper key={id} config={config} modelWorldBounds={modelWorldBounds} />
            ))}
        </>
    );
};

export default PipelineSlicePlaneHelpers;
