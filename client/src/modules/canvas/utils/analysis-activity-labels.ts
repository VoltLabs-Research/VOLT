import type { Analysis } from '@volt/contracts/modules/analysis/domain';
import type { AnalysisActivitySummary } from './analysis-status-selectors';

export interface AnalysisActivityLabels {
    runningCount: number;
    queuedCount: number;
    runningLabel: string;
    queuedLabel: string;
    runningTitle: string;
    queuedTitle: string;
}

const EMPTY_LABELS: AnalysisActivityLabels = {
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

const summarizeAnalysisNames = (analyses: readonly Analysis[]): string => {
    if (analyses.length === 0) {
        return '';
    }

    const names = analyses.map(getAnalysisName);
    if (names.length <= 2) {
        return names.join(', ');
    }

    return `${names[0]} +${names.length - 1}`;
};

const buildAnalysisTitle = (analyses: readonly Analysis[]): string => {
    return analyses.map(getAnalysisName).join(', ');
};

/**
 * Turns the shared activity summary into status-bar wording.
 *
 * A hook used to do this *and* decide which analyses were running, walking the jobs
 * feed itself and resolving each one as `jobsDerived ?? persisted` — the opposite
 * precedence to the merge every other view used, and with no artifact-upload filter.
 * The status bar could call an analysis queued while the tree called it running. Only
 * the wording is left here; membership comes from the one status map.
 */
export const formatAnalysisActivityLabels = (
    summary: AnalysisActivitySummary
): AnalysisActivityLabels => {
    const { runningAnalyses, queuedAnalyses } = summary;

    if (runningAnalyses.length === 0 && queuedAnalyses.length === 0) {
        return EMPTY_LABELS;
    }

    return {
        runningCount: runningAnalyses.length,
        queuedCount: queuedAnalyses.length,
        runningLabel: runningAnalyses.length > 0 ? summarizeAnalysisNames(runningAnalyses) : 'Idle',
        queuedLabel: summarizeAnalysisNames(queuedAnalyses),
        runningTitle: buildAnalysisTitle(runningAnalyses),
        queuedTitle: buildAnalysisTitle(queuedAnalyses)
    };
};
