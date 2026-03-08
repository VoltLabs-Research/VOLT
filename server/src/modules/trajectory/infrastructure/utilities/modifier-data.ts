const DEFAULT_ANALYSIS_ID = 'default';

export const normalizeAnalysisId = (analysisId?: string): string | undefined => {
    if (analysisId && analysisId !== DEFAULT_ANALYSIS_ID) {
        return analysisId;
    }
    return undefined;
};

export const extractModifierAtomData = (
    modifierData: Record<string, unknown>[] | null
): Record<string, unknown>[] | null => {
    if (!modifierData) return null;
    const asRecord = modifierData as unknown as Record<string, unknown>;
    if (asRecord && typeof asRecord === 'object' && 'data' in asRecord && Array.isArray(asRecord.data)) {
        return asRecord.data as Record<string, unknown>[];
    }
    return modifierData;
};
