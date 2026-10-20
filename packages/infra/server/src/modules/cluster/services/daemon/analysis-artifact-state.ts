import type { AnalysisExpectedArtifact } from '@shared/contracts/types/AnalysisProps';

export const isArtifactSettled = (artifact: AnalysisExpectedArtifact): boolean => {
    return artifact.status === 'ready' || artifact.produced === false;
};

export const areArtifactsSettled = (expectedArtifacts: AnalysisExpectedArtifact[]): boolean => {
    return expectedArtifacts.length > 0 && expectedArtifacts.every(isArtifactSettled);
};
