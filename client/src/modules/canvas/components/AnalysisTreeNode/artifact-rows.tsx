import { isRenderableSceneExporter } from '../../utils/plugin-exposure-export';

import type { AnalysisExpectedArtifact } from '@volt/contracts/modules/analysis/domain';
import type { RenderableExposure } from '@/modules/plugin/hooks/plugin/use-plugin-selectors';

export interface ArtifactRow {
    key: string;
    artifact?: AnalysisExpectedArtifact;
    exposure?: RenderableExposure;
}

const IN_FLIGHT_ARTIFACT_STATUSES = new Set<AnalysisExpectedArtifact['status']>([
    'pending',
    'generating',
    'uploading'
]);

/**
 * The plugin declares its exposures up front, so an expected artifact exists
 * before anything produces it. Two ways to know nothing ever will: the exporter
 * said so (`produced === false`), or the analysis settled with the artifact
 * still in flight — which also covers rows recorded before exporters reported.
 *
 * `failed` is kept visible on purpose: that is a result, not an absence.
 */
const wasNeverExported = (
    artifact: AnalysisExpectedArtifact,
    isAnalysisSettled: boolean
): boolean => {
    if (artifact.produced === false) {
        return true;
    }

    return isAnalysisSettled && IN_FLIGHT_ARTIFACT_STATUSES.has(artifact.status);
};

export const buildArtifactRows = (
    expectedArtifacts: AnalysisExpectedArtifact[] | undefined,
    exposures: RenderableExposure[],
    isAnalysisSettled = false
): ArtifactRow[] => {
    const renderableExpectedArtifacts = (expectedArtifacts ?? [])
        .filter((artifact) => isRenderableSceneExporter(artifact.exporter));
    const exposureById = new Map(exposures.map((exposure) => [exposure.exposureId, exposure]));
    const rows: ArtifactRow[] = renderableExpectedArtifacts
        .map((artifact) => ({
            key: artifact.exposureId,
            artifact,
            exposure: exposureById.get(artifact.exposureId)
        }))
        .filter((row) => row.exposure || !wasNeverExported(row.artifact, isAnalysisSettled));
    const expectedIds = new Set(renderableExpectedArtifacts.map((artifact) => artifact.exposureId));

    for (const exposure of exposures) {
        if (!expectedIds.has(exposure.exposureId)) {
            rows.push({
                key: exposure.exposureId,
                exposure
            });
        }
    }

    return rows;
};

