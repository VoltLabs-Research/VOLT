import { useCallback } from 'react';
import { useTrajectoryStore } from '@/stores/slices/trajectory';
import { useRasterStore } from '@/stores/slices/raster';
import { useAnalysisConfigStore } from '@/stores/slices/analysis';
import { useEditorStore } from '@/stores/slices/editor';
import { useUIStore } from '@/stores/slices/ui';

/**
 * Hook to reset all team-dependent state when switching teams.
 * Centralizes the reset logic to avoid duplication across components.
 */
const useTeamStateReset = () => {
    const resetAllTeamState = useCallback(() => {
        const { reset: resetTrajectories } = useTrajectoryStore.getState();
        const { clearFrameCache } = useRasterStore.getState();
        const { resetAnalysisConfig } = useAnalysisConfigStore.getState();
        const { resetModel } = useEditorStore.getState();
        const { resetTimesteps } = useEditorStore.getState();
        const { resetPlayback } = useEditorStore.getState();
        const { resetEditorUI } = useUIStore.getState();
        const { reset: resetRenderConfig } = useEditorStore.getState().renderConfig;

        resetTrajectories();
        clearFrameCache();
        resetAnalysisConfig();
        resetModel();
        resetTimesteps();
        resetPlayback();
        resetEditorUI();
        resetRenderConfig();
    }, []);

    return { resetAllTeamState };
};

export default useTeamStateReset;
