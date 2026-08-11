import useRetryFailedFrames from '@/modules/analysis/hooks/use-retry-failed-frames';
import { AnalysisStatus } from '../utils/analysis-status';
import { sileo } from 'sileo';
import { useCallback, useRef } from 'react';
import { usePendingPluginExecutionsStore } from '../store/use-pending-plugin-executions-store';

import type { RefObject } from 'react';
import type { Analysis } from '@volt/contracts/modules/analysis/domain';
import type { AnalysisStatusSocketPayload } from './use-sidebar-scene-socket-sync';

interface UseSidebarSceneExecutionNotificationsInput {
    analyses: Analysis[];
    selectedAnalysisIdRef: RefObject<string | undefined>;
    setAnalysisId: (analysisId?: string, options?: { replace?: boolean }) => void;
    setCurrentTimestep: (timestep: number) => void;
}

const useSidebarSceneExecutionNotifications = ({
    analyses,
    selectedAnalysisIdRef,
    setAnalysisId,
    setCurrentTimestep
}: UseSidebarSceneExecutionNotificationsInput) => {
    const retryFailedFrames = useRetryFailedFrames();

    const autoSelectChainRef = useRef<string | null>(null);

    const clearAutoSelectChain = useCallback(() => {
        autoSelectChainRef.current = null;
    }, []);

    const selectAnalysis = useCallback((analysisId: string, timestep?: number) => {
        if (timestep !== undefined) {
            setCurrentTimestep(timestep);
        }
        setAnalysisId(analysisId, { replace: true });
    }, [setAnalysisId, setCurrentTimestep]);

    const announceAnalysisStatus = useCallback((payload: AnalysisStatusSocketPayload) => {
        const { analysisId } = payload;
        const pendingStore = usePendingPluginExecutionsStore.getState();
        const pending = pendingStore.get(analysisId);
        const pluginName = pending?.pluginName
            ?? analyses.find((analysis) => analysis._id === analysisId)?.pluginDisplayName
            ?? 'Analysis';

        if (payload.status === AnalysisStatus.Running) {
            if (pending) {
                pendingStore.update(analysisId, { totalFrames: payload.totalFrames });

                const selectedAnalysisId = selectedAnalysisIdRef.current;
                const selectedPending = selectedAnalysisId
                    ? pendingStore.get(selectedAnalysisId)
                    : undefined;
                const shouldAutoSelect = Boolean(pending.autoSelect)
                    && (!selectedAnalysisId
                        || selectedAnalysisId === analysisId
                        || !selectedPending?.autoSelect);

                if (shouldAutoSelect && selectedAnalysisId !== analysisId) {
                    autoSelectChainRef.current = analysisId;
                    selectAnalysis(analysisId, pending.timestep);
                }
            }
            return;
        }

        if (payload.status === AnalysisStatus.Completed) {
            const artifactsReady = payload.artifactStatus === undefined || payload.artifactStatus === 'ready';
            const title = `${pluginName} completed`;
            const description = artifactsReady
                ? 'Artifacts are ready in Scene Collection.'
                : 'Analysis completed. Artifacts are still uploading.';

            if (!pending) {
                sileo.success({
                    title,
                    description
                });
                return;
            }

            const entry = pendingStore.remove(analysisId);
            const selectedAnalysisId = selectedAnalysisIdRef.current;
            const canAutoSelect = Boolean(entry?.autoSelect)
                && (!selectedAnalysisId
                    || selectedAnalysisId === analysisId
                    || selectedAnalysisId === autoSelectChainRef.current);

            if (canAutoSelect) {
                autoSelectChainRef.current = analysisId;
                selectAnalysis(analysisId, entry?.timestep);
                sileo.success({
                    title,
                    description: artifactsReady
                        ? 'Analysis selected - results are ready in Scene Collection.'
                        : 'Analysis selected - artifacts are still uploading.'
                });
                return;
            }

            sileo.success({
                title,
                description,
                button: {
                    title: 'View',
                    onClick: () => selectAnalysis(analysisId, entry?.timestep)
                }
            });
            return;
        }

        if (payload.status === AnalysisStatus.Failed) {
            pendingStore.remove(analysisId);

            const failedFrames = payload.failedFrames ?? 0;
            sileo.error({
                title: `${pluginName} failed`,
                description: failedFrames > 0
                    ? `${failedFrames} frame${failedFrames === 1 ? '' : 's'} failed. Retry to re-run the failed frames.`
                    : 'The analysis failed. Retry to re-run the failed frames.',
                duration: 8000,
                button: {
                    title: 'Retry',
                    onClick: () => {
                        void retryFailedFrames(analysisId);
                    }
                }
            });
        }
    }, [analyses, retryFailedFrames, selectAnalysis, selectedAnalysisIdRef]);

    return {
        announceAnalysisStatus,
        clearAutoSelectChain
    };
};

export default useSidebarSceneExecutionNotifications;
