import { CanvasAnalysisStatusEnum } from '../utils/analysis-status';
import { useMemo } from 'react';

import type { CanvasAnalysisStatus, CanvasAnalysisStatusEntry } from '../utils/analysis-status';
import type { AnalysisActivityTone } from '../utils/analysis-status-selectors';

export type { AnalysisActivityTone };

const getAnalysisTone = (status?: CanvasAnalysisStatus): AnalysisActivityTone | undefined => {
    if (status === CanvasAnalysisStatusEnum.Running) return 'running';
    if (status === CanvasAnalysisStatusEnum.Pending) return 'queued';
    if (status === CanvasAnalysisStatusEnum.Failed) return 'failed';
    return undefined;
};

const useAnalysisActivityTone = (
    statusMap: Map<string, CanvasAnalysisStatusEntry>
) => {
    const toneByAnalysisId = useMemo(() => {
        const next = new Map<string, AnalysisActivityTone>();
        statusMap.forEach((entry, analysisId) => {
            const tone = getAnalysisTone(entry.status);
            if (tone) next.set(analysisId, tone);
        });
        return next;
    }, [statusMap]);

    return { toneByAnalysisId };
};

export default useAnalysisActivityTone;
