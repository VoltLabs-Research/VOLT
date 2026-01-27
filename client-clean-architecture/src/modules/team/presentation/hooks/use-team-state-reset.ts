import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useTrajectoryStore } from '@/modules/trajectory/presentation/stores';
import { useRasterStore } from '@/modules/raster/presentation/stores';
import { useAnalysisStore } from '@/modules/analysis/presentation/stores';
import { useEditorStore } from '@/modules/canvas/presentation/stores/editor';
import { useUIStore } from '@/shared/presentation/stores/slices/ui';
import { trajectoryQueryKeys } from '@/modules/trajectory/presentation/hooks/use-trajectory-queries';

const useTeamStateReset = () => {
    const queryClient = useQueryClient();

    const resetAllTeamState = useCallback(() => {
        const { clearCurrentTrajectory } = useTrajectoryStore.getState();
        const { clearFrameCache } = useRasterStore.getState();
        const { resetAnalysisConfig } = useAnalysisStore.getState();
        const { resetModel } = useEditorStore.getState();
        const { resetTimesteps } = useEditorStore.getState();
        const { resetPlayback } = useEditorStore.getState();
        const uiState = useUIStore.getState() as any;
        const { reset: resetRenderConfig } = useEditorStore.getState().renderConfig;

        // Reset TanStack Query trajectory cache
        queryClient.invalidateQueries({ queryKey: trajectoryQueryKeys.all });

        clearCurrentTrajectory();
        clearFrameCache();
        resetAnalysisConfig();
        resetModel();
        resetTimesteps();
        resetPlayback();
        uiState.resetEditorUI?.();
        resetRenderConfig();
    }, [queryClient]);

    return { resetAllTeamState };
};

export default useTeamStateReset;
