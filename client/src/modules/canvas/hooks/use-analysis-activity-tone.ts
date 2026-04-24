import { CanvasAnalysisStatusEnum } from '../utilities/analysis-status';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { CanvasAnalysisStatus, CanvasAnalysisStatusEntry } from '../utilities/analysis-status';
import type { TimelineTickTone } from './use-timeline-job-activity';

export type AnalysisActivityTone = TimelineTickTone | 'failed';

const SESSION_COMPLETION_HIGHLIGHT_MS = 3500;

const isInProgressStatus = (status?: CanvasAnalysisStatus): boolean => {
    return status === CanvasAnalysisStatusEnum.Running || status === CanvasAnalysisStatusEnum.Pending;
};

// Why: mirrors use-timeline-job-activity — any analysis we observe as "in
// progress" during this session, and later transitions to completed, gets a
// short-lived success highlight. Analyses that were already completed on mount
// do not. This avoids recoloring the whole tree every time the user opens the
// canvas and makes the just-ran analysis visually stand out.
const useAnalysisActivityTone = (
    statusMap: Map<string, CanvasAnalysisStatusEntry>
) => {
    const inProgressIdsRef = useRef<Set<string>>(new Set());
    const highlightTimersRef = useRef<Map<string, number>>(new Map());
    const [highlightedAnalysisIds, setHighlightedAnalysisIds] = useState<Set<string>>(new Set());

    const clearHighlightTimer = useCallback((analysisId: string) => {
        const timer = highlightTimersRef.current.get(analysisId);
        if (timer !== undefined) {
            window.clearTimeout(timer);
            highlightTimersRef.current.delete(analysisId);
        }
    }, []);

    const clearAllHighlightTimers = useCallback(() => {
        highlightTimersRef.current.forEach((timer) => window.clearTimeout(timer));
        highlightTimersRef.current.clear();
    }, []);

    const markHighlight = useCallback((analysisId: string) => {
        clearHighlightTimer(analysisId);
        setHighlightedAnalysisIds((current) => {
            const next = new Set(current);
            next.add(analysisId);
            return next;
        });

        const timer = window.setTimeout(() => {
            setHighlightedAnalysisIds((current) => {
                if (!current.has(analysisId)) return current;
                const next = new Set(current);
                next.delete(analysisId);
                return next;
            });
            highlightTimersRef.current.delete(analysisId);
        }, SESSION_COMPLETION_HIGHLIGHT_MS);

        highlightTimersRef.current.set(analysisId, timer);
    }, [clearHighlightTimer]);

    useEffect(() => {
        statusMap.forEach((entry, analysisId) => {
            const status = entry.status;
            if (isInProgressStatus(status)) {
                inProgressIdsRef.current.add(analysisId);
                return;
            }

            if (status === CanvasAnalysisStatusEnum.Completed && inProgressIdsRef.current.has(analysisId)) {
                inProgressIdsRef.current.delete(analysisId);
                markHighlight(analysisId);
                return;
            }

            inProgressIdsRef.current.delete(analysisId);
        });
    }, [statusMap, markHighlight]);

    useEffect(() => {
        return () => {
            clearAllHighlightTimers();
        };
    }, [clearAllHighlightTimers]);

    const getAnalysisTone = useCallback((
        analysisId: string,
        status?: CanvasAnalysisStatus
    ): AnalysisActivityTone | undefined => {
        if (status === CanvasAnalysisStatusEnum.Running) return 'running';
        if (status === CanvasAnalysisStatusEnum.Pending) return 'queued';
        if (status === CanvasAnalysisStatusEnum.Failed) return 'failed';
        if (status === CanvasAnalysisStatusEnum.Completed && highlightedAnalysisIds.has(analysisId)) {
            return 'completed';
        }
        return undefined;
    }, [highlightedAnalysisIds]);

    const toneByAnalysisId = useMemo(() => {
        const next = new Map<string, AnalysisActivityTone>();
        statusMap.forEach((entry, analysisId) => {
            const tone = getAnalysisTone(analysisId, entry.status);
            if (tone) next.set(analysisId, tone);
        });
        return next;
    }, [statusMap, getAnalysisTone]);

    return {
        toneByAnalysisId,
        getAnalysisTone
    };
};

export default useAnalysisActivityTone;
