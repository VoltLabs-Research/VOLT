import useAnalysisStatus from './use-analysis-status';
import { CanvasAnalysisStatusEnum } from '../utilities/analysis-status';

import {
    buildSceneArtifactsQueryOptions,
    invalidateSceneArtifacts,
    useSceneArtifactsQueries
} from '@/modules/trajectory/hooks/scene-artifacts/queries';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { sileo } from 'sileo';
import useAccessDenied from '@/shared/presentation/hooks/use-access-denied';

import type { RenderableExposure } from '@/modules/plugin/hooks/plugin/use-plugin-selectors';
import type { RenderableExposurePayload, ListSceneArtifactsInputDTO } from '@/modules/trajectory/api/dtos/scene-artifacts';

export type ExposureLoadState = 'idle' | 'loading' | 'loaded' | 'error';

export interface ExposureEntry {
    state: ExposureLoadState;
    exposures: RenderableExposure[];
    error?: unknown;
}

export const DEFAULT_ENTRY: ExposureEntry = { state: 'idle', exposures: [] };

interface UseExposureManagerProps {
    trajectoryId?: string;
}

interface UseExposureManagerReturn {
    exposureEntries: Map<string, ExposureEntry>;
    getEntry: (analysisId: string) => ExposureEntry;
    loadExposuresForAnalysis: (analysisId: string) => Promise<void>;
    resetEntries: () => void;
}

const buildParams = (trajectoryId: string, analysisId: string): ListSceneArtifactsInputDTO => ({
    trajectoryId,
    analysisId,
    sourceType: 'plugin-exposure',
    projection: 'renderable-exposures',
    page: 1,
    limit: 1000
});

const useExposureManager = ({ trajectoryId }: UseExposureManagerProps): UseExposureManagerReturn => {
    const queryClient = useQueryClient();
    const { checkAccessDeniedError } = useAccessDenied();
    const [trackedAnalysisIds, setTrackedAnalysisIds] = useState<Set<string>>(new Set());
    const trackedIdsRef = useRef(trackedAnalysisIds);
    trackedIdsRef.current = trackedAnalysisIds;

    const reportedErrorsRef = useRef<Set<string>>(new Set());

    const analysisIdArray = useMemo(
        () => Array.from(trackedAnalysisIds),
        [trackedAnalysisIds]
    );

    const queryResults = useSceneArtifactsQueries(
        analysisIdArray.map((analysisId) => buildParams(trajectoryId!, analysisId))
    );

    // Surface errors: RBAC check + toast, tracked per analysis to avoid duplicates
    useEffect(() => {
        for (let i = 0; i < analysisIdArray.length; i++) {
            const analysisId = analysisIdArray[i];
            const result = queryResults[i];

            if (result.isError && result.error && !reportedErrorsRef.current.has(analysisId)) {
                reportedErrorsRef.current.add(analysisId);
                if (!checkAccessDeniedError(result.error)) {
                    sileo.error({ title: 'Failed to load exposures' });
                }
            }

            // Clear error tracking when the query is no longer in error state
            if (!result.isError && reportedErrorsRef.current.has(analysisId)) {
                reportedErrorsRef.current.delete(analysisId);
            }
        }
    }, [analysisIdArray, queryResults, checkAccessDeniedError]);

    // Fallback: when any tracked analysis flips to Completed, refresh the broad
    // scene artifacts key. Realtime artifact merging is driven by the
    // scene-artifact.upserted socket event in useCanvasSidebarScene.
    const { statusMap } = useAnalysisStatus({ trajectoryId, enabled: !!trajectoryId });
    const prevStatusesRef = useRef<Map<string, string>>(new Map());

    useEffect(() => {
        if (!trajectoryId) return;
        const prev = prevStatusesRef.current;
        const next = new Map<string, string>();
        let hasNewCompletion = false;

        for (const analysisId of trackedIdsRef.current) {
            const current = statusMap.get(analysisId)?.status;
            if (current) next.set(analysisId, current);
            if (current === CanvasAnalysisStatusEnum.Completed
                && prev.get(analysisId)
                && prev.get(analysisId) !== CanvasAnalysisStatusEnum.Completed) {
                hasNewCompletion = true;
            }
        }

        if (hasNewCompletion) {
            void invalidateSceneArtifacts();
        }
        prevStatusesRef.current = next;
    }, [statusMap, trajectoryId, queryClient]);

    const exposureEntries = useMemo(() => {
        const map = new Map<string, ExposureEntry>();

        for (let i = 0; i < analysisIdArray.length; i++) {
            const analysisId = analysisIdArray[i];
            const result = queryResults[i];

            if (result.isLoading || result.isFetching) {
                map.set(analysisId, { state: 'loading', exposures: [] });
            } else if (result.isError) {
                map.set(analysisId, { state: 'error', exposures: [], error: result.error });
            } else if (result.isSuccess) {
                const exposures = ((result.data as { data?: RenderableExposurePayload[] } | undefined)?.data ?? []);
                map.set(analysisId, {
                    state: 'loaded',
                    exposures: exposures as RenderableExposure[]
                });
            } else {
                map.set(analysisId, DEFAULT_ENTRY);
            }
        }

        return map;
    }, [analysisIdArray, queryResults]);

    const exposureEntriesRef = useRef(exposureEntries);
    exposureEntriesRef.current = exposureEntries;

    const getEntry = useCallback((analysisId: string): ExposureEntry => {
        return exposureEntriesRef.current.get(analysisId) ?? DEFAULT_ENTRY;
    }, []);

    const resetEntries = useCallback(() => {
        const currentIds = trackedIdsRef.current;
        if (trajectoryId && currentIds.size > 0) {
            currentIds.forEach((analysisId) => {
                const params = buildParams(trajectoryId, analysisId);
                queryClient.removeQueries({ queryKey: buildSceneArtifactsQueryOptions(params).queryKey });
            });
        }
        reportedErrorsRef.current.clear();
        setTrackedAnalysisIds(new Set());
    }, [trajectoryId, queryClient]);

    const loadExposuresForAnalysis = useCallback(async (analysisId: string) => {
        if (!trajectoryId) return;

        if (trackedIdsRef.current.has(analysisId)) {
            const queryKey = buildSceneArtifactsQueryOptions(buildParams(trajectoryId, analysisId)).queryKey;
            const state = queryClient.getQueryState(queryKey);
            if (state?.status === 'error') {
                reportedErrorsRef.current.delete(analysisId);
                await queryClient.invalidateQueries({ queryKey });
            }
            return;
        }

        setTrackedAnalysisIds((prev) => {
            const next = new Set(prev);
            next.add(analysisId);
            return next;
        });
    }, [trajectoryId, queryClient]);

    return {
        exposureEntries,
        getEntry,
        loadExposuresForAnalysis,
        resetEntries
    };
};

export default useExposureManager;
