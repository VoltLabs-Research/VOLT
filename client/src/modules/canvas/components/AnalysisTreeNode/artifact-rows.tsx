import { TREE_ARTIFACT_LABEL_CLASS, TREE_ARTIFACT_LABEL_TONE_CLASS } from '../ObjectsPanel/tree-classes';
import { AlertCircle, Atom, Clock3, LoaderCircle, UploadCloud } from 'lucide-react';
import { isRenderableSceneExporter } from '../../utils/plugin-exposure-export';

import type { AnalysisArtifactStatus, AnalysisExpectedArtifact } from '@volt/contracts/modules/analysis/domain';
import type { RenderableExposure } from '@/modules/plugin/hooks/plugin/use-plugin-selectors';

const ICON_STYLE = {
    width: 12,
    height: 12
};

const READY_ICON_STYLE = {
    ...ICON_STYLE,
    color: 'var(--accent-blue)'
};

export interface ArtifactRow {
    key: string;
    artifact?: AnalysisExpectedArtifact;
    exposure?: RenderableExposure;
}

/**
 * Pairs the artifacts an analysis promised with the exposures that already
 * loaded, keeping promised-but-missing artifacts as placeholder rows and
 * appending exposures that were never announced.
 */
export const buildArtifactRows = (
    expectedArtifacts: AnalysisExpectedArtifact[] | undefined,
    exposures: RenderableExposure[]
): ArtifactRow[] => {
    const renderableExpectedArtifacts = (expectedArtifacts ?? [])
        .filter((artifact) => isRenderableSceneExporter(artifact.exporter));
    const exposureById = new Map(exposures.map((exposure) => [exposure.exposureId, exposure]));
    const rows: ArtifactRow[] = renderableExpectedArtifacts.map((artifact) => ({
        key: artifact.exposureId,
        artifact,
        exposure: exposureById.get(artifact.exposureId)
    }));
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

/**
 * `.canvas-tree-artifact-label` and its status tone. The tone is looked up rather than
 * interpolated, so every class Tailwind has to see is a complete literal, and `ready`
 * has no entry because the stylesheet only tinted the *other* states.
 */
export const buildArtifactNameClassName = (
    artifact: AnalysisExpectedArtifact | undefined,
    isRecentlyReady: boolean
): string => {
    if (isRecentlyReady) {
        return `${TREE_ARTIFACT_LABEL_CLASS} ${TREE_ARTIFACT_LABEL_TONE_CLASS['ready-recent']}`;
    }

    if (artifact && artifact.status !== 'ready') {
        return `${TREE_ARTIFACT_LABEL_CLASS} ${TREE_ARTIFACT_LABEL_TONE_CLASS[artifact.status]}`;
    }

    return TREE_ARTIFACT_LABEL_CLASS;
};

export const getArtifactIcon = (status: AnalysisArtifactStatus) => {
    if (status === 'failed') return <AlertCircle style={ICON_STYLE} />;
    if (status === 'ready') return <Atom style={READY_ICON_STYLE} />;
    if (status === 'uploading') return <UploadCloud style={ICON_STYLE} />;
    if (status === 'generating') return <LoaderCircle style={ICON_STYLE} />;
    return <Clock3 style={ICON_STYLE} />;
};
