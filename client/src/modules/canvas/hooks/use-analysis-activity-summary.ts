import { useAnalysesByTrajectoryQuery } from '@/modules/analysis/hooks/queries';
import { normalizeCanvasAnalysisStatus } from '../utilities/analysis-status';
import { AnalysisStatus } from '@/modules/fractal/types';
import { useMemo } from 'react';

import type { Analysis } from '@/modules/analysis/api/entities/analysis';
import type { Trajectory } from '@/modules/trajectory/api/entities/trajectory';

interface AnalysisActivitySummary {
    runningCount: number;
    queuedCount: number;
    runningLabel: string;
    queuedLabel: string;
    runningTitle: string;
    queuedTitle: string;
};

const EMPTY_SUMMARY: AnalysisActivitySummary = {
    runningCount: 0,
    queuedCount: 0,
    runningLabel: 'Idle',
    queuedLabel: '',
    runningTitle: '',
    queuedTitle: ''
};

const getAnalysisName = (analysis: Analysis): string => {
    return analysis.pluginDisplayName?.trim() || analysis.plugin?.trim() || 'Analysis';
};

const summarizeAnalysisNames = (analyses: Analysis[]): string => {
    if (analyses.length === 0) {
        return '';
    }

    const names = analyses.map(getAnalysisName);
    if (names.length <= 2) {
        return names.join(', ');
    }

    return `${names[0]} +${names.length - 1}`;
};

const buildAnalysisTitle = (analyses: Analysis[]): string => {
    return analyses.map(getAnalysisName).join(', ');
};

const useAnalysisActivitySummary = (trajectory?: Trajectory | null): AnalysisActivitySummary => {
    const trajectoryId = trajectory?._id;
    const analysesQuery = useAnalysesByTrajectoryQuery(
        {
            trajectoryId: trajectoryId ?? '',
            page: 1,
            limit: 100
        },
        { enabled: !!trajectoryId }
    );

    return useMemo(() => {
        const queriedAnalyses = (analysesQuery.data as { data?: Analysis[] } | undefined)?.data ?? [];
        const analyses = queriedAnalyses.length > 0 ? queriedAnalyses : (trajectory?.analysis ?? []);

        if (!analyses.length) {
            return EMPTY_SUMMARY;
        }

        const runningAnalyses: Analysis[] = [];
        const queuedAnalyses: Analysis[] = [];

        for (const analysis of analyses) {
            const normalizedStatus = normalizeCanvasAnalysisStatus(analysis.status);

            if (normalizedStatus === AnalysisStatus.Running) {
                runningAnalyses.push(analysis);
                continue;
            }

            if (normalizedStatus === AnalysisStatus.Pending) {
                queuedAnalyses.push(analysis);
            }
        }

        if (runningAnalyses.length === 0 && queuedAnalyses.length === 0) {
            return EMPTY_SUMMARY;
        }

        return {
            runningCount: runningAnalyses.length,
            queuedCount: queuedAnalyses.length,
            runningLabel: runningAnalyses.length > 0 ? summarizeAnalysisNames(runningAnalyses) : 'Idle',
            queuedLabel: summarizeAnalysisNames(queuedAnalyses),
            runningTitle: buildAnalysisTitle(runningAnalyses),
            queuedTitle: buildAnalysisTitle(queuedAnalyses)
        };
    }, [analysesQuery.data, trajectory?.analysis]);
};

export default useAnalysisActivitySummary;
