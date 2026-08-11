import useCanvasAnalysisStatus from './use-canvas-analysis-status';
import { CanvasAnalysisStatusEnum } from '../utils/analysis-status';
import { isRenderableSceneExport } from '../utils/plugin-exposure-export';

import {
    buildSceneArtifactsQueryOptions,
    invalidateSceneArtifacts,
    useSceneArtifactsQueries
} from '@/modules/trajectory/hooks/scene-artifacts/queries';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { sileo } from 'sileo';
import useAccessDenied from '@/shared/ui/hooks/use-access-denied';

import type { RenderableExposure } from '@/modules/plugin/hooks/plugin/use-plugin-selectors';
import type { RenderableExposurePayload, ListSceneArtifactsInput } from '@/modules/trajectory/api/services/scene-artifacts-service';

type ExposureLoadState = 'idle' | 'loading' | 'loaded' | 'error';

export interface ExposureEntry {
    state: ExposureLoadState;
    exposures: RenderableExposure[];
    error?: unknown;
}

export const DEFAULT_ENTRY: ExposureEntry = {
    state: 'idle',
    exposures: []
};

interface UseExposureManagerProps {
    trajectoryId?: string;
}

interface UseExposureManagerReturn {
    exposureEntries: Map<string, ExposureEntry>;
    getEntry: (analysisId: string) => ExposureEntry;
    loadExposuresForAnalysis: (analysisId: string) => Promise<void>;
    resetEntries: () => void;
}

const buildParams = (trajectoryId: string, analysisId: string): ListSceneArtifactsInput => ({
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

            if (!result.isError && reportedErrorsRef.current.has(analysisId)) {
                reportedErrorsRef.current.delete(analysisId);
            }
        }
    }, [analysisIdArray, queryResults, checkAccessDeniedError]);

    const { statusMap } = useCanvasAnalysisStatus({
        trajectoryId,
        enabled: !!trajectoryId
    });
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

            /*
             * The branch order is what makes an exposure selectable the moment it lands,
             * so it matters more than it looks: the data has to be read before the fetch
             * flags. Each exposure that becomes ready invalidates this query, `isFetching`
             * is true for every one of those background refetches, and React Query keeps
             * `data` on the entry throughout — so testing `isFetching` first emptied the
             * whole list on each arrival and every row fell back to a disabled placeholder
             * until the analysis stopped producing. That was the "wait for all of them".
             */
            const page = result.data as { data?: RenderableExposurePayload[] } | undefined;
            const exposures = ((page?.data ?? []) as RenderableExposure[])
                .filter((exposure) => isRenderableSceneExport(exposure.export));

            if (result.isError) {
                map.set(analysisId, {
                    state: 'error',
                    exposures,
                    error: result.error
                });
            } else if (page) {
                /* Gated on the page, not on `page.data`: a malformed body must not read as loaded. */
                map.set(analysisId, {
                    state: 'loaded',
                    exposures
                });
            } else if (result.isLoading || result.isFetching) {
                map.set(analysisId, {
                    state: 'loading',
                    exposures: []
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
