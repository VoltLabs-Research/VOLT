import { useCanvasPipelineStore } from '@/modules/canvas/store/canvas-pipeline';

import type { StageConfig } from '@/modules/canvas/store/canvas-pipeline';

interface StageConfigHandle<T extends StageConfig> {
    config: T | undefined;
    patch: (next: Partial<T>) => void;
}

const useStageConfig = <T extends StageConfig>(stageId: string, trajectoryId?: string): StageConfigHandle<T> => {
    const config = useCanvasPipelineStore((s) =>
        (trajectoryId ? s.byTrajectory[trajectoryId] : undefined)
            ?.find((stage) => stage.id === stageId)?.config as T | undefined
    );
    const updateStageConfig = useCanvasPipelineStore((s) => s.updateStageConfig);

    return {
        config,
        patch: (next) => updateStageConfig(stageId, next, trajectoryId)
    };
};

export default useStageConfig;
