const DEFAULT_ANALYSIS_ID = 'default';

export const normalizeAnalysisId = (analysisId?: string): string | undefined => {
    if (analysisId && analysisId !== DEFAULT_ANALYSIS_ID) {
        return analysisId;
    }
    return undefined;
};
