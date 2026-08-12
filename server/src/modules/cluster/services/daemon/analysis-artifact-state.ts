import type { AnalysisExpectedArtifact } from '@shared/contracts/types/AnalysisProps';

/**
 * An expected artifact that will not become any readier: it landed, or the
 * exporter reported it emitted nothing so no upload is coming.
 *
 * `failed` is deliberately excluded — counting it here would let a later
 * successful stage report promote a failed analysis' `artifactStatus` to
 * `ready`, laundering the failure away.
 */
export const isArtifactSettled = (artifact: AnalysisExpectedArtifact): boolean => {
    return artifact.status === 'ready' || artifact.produced === false;
};

/**
 * Both the stage projection and the scene-artifact ingest decide whether an
 * analysis' `artifactStatus` can reach `ready`. They must ask the same question
 * or the two disagree and the analysis sticks at `uploading`.
 */
export const areArtifactsSettled = (expectedArtifacts: AnalysisExpectedArtifact[]): boolean => {
    return expectedArtifacts.length > 0 && expectedArtifacts.every(isArtifactSettled);
};
