import { AnalysisStatus, normalizeCanvasAnalysisStatus } from './analysis-status';
import { getSelectedTimestepsForAnalysis } from './selected-timestep-analysis';
import { DEFAULT_ENTRY } from '../hooks/use-exposure-manager';

import type { Analysis } from '@volt/contracts/modules/analysis/domain';
import type { CanvasAnalysisStatus } from './analysis-status';
import type { ExposureEntry } from '../hooks/use-exposure-manager';

export interface AnalysisSectionData {
    analysis: Analysis;
    entry: ExposureEntry;
    isCurrentAnalysis: boolean;
}

export const buildAnalysisSections = (
    analyses: Analysis[],
    exposureEntries: Map<string, ExposureEntry>,
    selectedAnalysisId?: string
): AnalysisSectionData[] => {
    return analyses.map((analysis) => ({
        analysis,
        entry: exposureEntries.get(analysis._id) ?? DEFAULT_ENTRY,
        isCurrentAnalysis: analysis._id === selectedAnalysisId
    }));
};

export const filterVisibleSections = (
    sections: AnalysisSectionData[],
    selectedAnalysisId: string | undefined,
    searchQuery: string,

    getResolvedStatus?: (analysisId: string) => CanvasAnalysisStatus | undefined
): AnalysisSectionData[] => {
    const query = searchQuery.trim().toLowerCase();

    return sections.filter((section) => {
        if (query && !section.analysis.pluginDisplayName.toLowerCase().includes(query)) {
            return false;
        }
        if (section.analysis._id === selectedAnalysisId) {
            return true;
        }

        const status = getResolvedStatus?.(section.analysis._id)
            ?? normalizeCanvasAnalysisStatus(section.analysis.status);
        return status !== undefined && status !== AnalysisStatus.Failed;
    });
};

export const filterSectionsByTimestep = (
    sections: AnalysisSectionData[],
    selectedAnalysisId: string | undefined,
    currentTimestep: number | undefined,
    trajectoryTimesteps: number[]
): AnalysisSectionData[] => {
    if (currentTimestep === undefined) {
        return sections;
    }

    return sections.filter((section) => {
        if (section.analysis._id === selectedAnalysisId) {
            return true;
        }

        const scoped = getSelectedTimestepsForAnalysis(section.analysis, trajectoryTimesteps);
        return scoped === undefined || scoped.includes(currentTimestep);
    });
};
