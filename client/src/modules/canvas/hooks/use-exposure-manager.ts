import useAnalysisStatus from './use-analysis-status';
import { CanvasAnalysisStatusEnum } from '../utilities/analysis-status';

import {
    buildSceneArtifactsQueryOptions,
    SCENE_ARTIFACTS_QUERY_KEYS,
    useSceneArtifactsQueries
} from '@/modules/trajectory/hooks/scene-artifacts/queries';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { sileo } from 'sileo';
import useAccessDenied from '@/shared/presentation/hooks/use-access-denied';

import type { RenderableExposure } from '@/modules/plugin/hooks/plugin/use-plugin-selectors';
import type { RenderableExposurePayload, ListSceneArtifactsInputDTO } from '@/modules/trajectory/api/dtos/scene-artifacts';
import type { SceneArtifact } from '@/modules/trajectory/api/entities/scene-artifacts';
import type { PaginatedResponse } from '@/shared/domain/pagination';

export type ExposureLoadState = 'idle' | 'loading' | 'loaded' | 'error';

export interface ExposureEntry {
    state: ExposureLoadState;
    exposures: RenderableExposure[];
    error?: unknown;
};

export const DEFAULT_ENTRY: ExposureEntry = { state: 'idle', exposures: [] };

interface UseExposureManagerProps {
    trajectoryId?: string;
};

interface UseExposureManagerReturn {
    exposureEntries: Map<string, ExposureEntry>;
    getEntry: (analysisId: string) => ExposureEntry;
    loadExposuresForAnalysis: (analysisId: string) => Promise<void>;
    resetEntries: () => void;
};

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
    const { checkRBACError } = useAccessDenied();
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
                if (!checkRBACError(result.error)) {
                    sileo.error({ title: 'Failed to load exposures' });
                }
            }

            // Clear error tracking when the query is no longer in error state
            if (!result.isError && reportedErrorsRef.current.has(analysisId)) {
                reportedErrorsRef.current.delete(analysisId);
            }
        }
    }, [analysisIdArray, queryResults, checkRBACError]);

    // Invalidate scene artifacts queries when an analysis transitions to 'completed'
    // so stale empty results are replaced with actual exposure data.
    const { statusMap } = useAnalysisStatus({ trajectoryId, enabled: !!trajectoryId });
    const prevStatusMapRef = useRef<Map<string, string>>(new Map());

    useEffect(() => {
        if (!trajectoryId) return;
        const prev = prevStatusMapRef.current;

        for (const analysisId of trackedIdsRef.current) {
            const currentStatus = statusMap.get(analysisId)?.status;
            const previousStatus = prev.get(analysisId);

            if (currentStatus === CanvasAnalysisStatusEnum.Completed && previousStatus && previousStatus !== CanvasAnalysisStatusEnum.Completed) {
                const params = buildParams(trajectoryId, analysisId);
                const queryKey = buildSceneArtifactsQueryOptions(params).queryKey;
                queryClient.invalidateQueries({ queryKey });
            }
        }

        // Also invalidate the broad scene artifacts key so timeline queries refresh too
        const hasNewCompletion = Array.from(trackedIdsRef.current).some((id) => {
            const cur = statusMap.get(id)?.status;
            const prv = prev.get(id);
            return cur === CanvasAnalysisStatusEnum.Completed && prv && prv !== CanvasAnalysisStatusEnum.Completed;
        });
        if (hasNewCompletion) {
            queryClient.invalidateQueries({ queryKey: SCENE_ARTIFACTS_QUERY_KEYS.sceneArtifacts() });
        }

        // Snapshot current statuses for next comparison
        const nextSnapshot = new Map<string, string>();
        for (const analysisId of trackedIdsRef.current) {
            const status = statusMap.get(analysisId)?.status;
            if (status) nextSnapshot.set(analysisId, status);
        }
        prevStatusMapRef.current = nextSnapshot;
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

        // If already tracked, check cache state to determine if we need to refetch
        if (trackedIdsRef.current.has(analysisId)) {
            const params = buildParams(trajectoryId, analysisId);
            const queryKey = buildSceneArtifactsQueryOptions(params).queryKey;
            const state = queryClient.getQueryState(queryKey);
            if (state?.fetchStatus === 'fetching') return;

            // Allow refetch if the cached result is empty (analysis may have completed since)
            if (state?.status === 'success') {
                const cached = queryClient.getQueryData<PaginatedResponse<SceneArtifact | RenderableExposurePayload>>(queryKey);
                const hasData = cached?.data && (cached.data as unknown[]).length > 0;
                if (hasData) return;
                // Empty success: invalidate so useQueries triggers a fresh fetch
                await queryClient.invalidateQueries({ queryKey });
                return;
            }

            // Error state: invalidate to trigger a refetch via useQueries
            if (state?.status === 'error') {
                reportedErrorsRef.current.delete(analysisId);
                await queryClient.invalidateQueries({ queryKey });
            }
            return;
        }

        // New analysis ID: add to tracked set, useQueries will start the fetch
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
