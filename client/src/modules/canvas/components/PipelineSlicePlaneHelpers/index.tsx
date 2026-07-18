import { useMemo } from 'react';
import SlicePlaneHelper from '@/modules/fractal/components/atoms/SlicePlaneHelper';
import { useActiveTrajectoryStages, collectEnabledSliceStages } from '@/modules/canvas/stores/canvas-pipeline';
import { toSlicePlaneConfig } from '@/modules/canvas/hooks/use-pipeline-slice-planes';
import type { ModelWorldBounds } from '@/modules/fractal/api/types/model';
import type { FC } from 'react';

interface PipelineSlicePlaneHelpersProps {
    modelWorldBounds?: ModelWorldBounds | null;
}

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
