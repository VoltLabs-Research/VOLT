import { CanvasTreeRow } from '../CanvasTree';
import { buildArtifactNameClassName, getArtifactIcon } from './artifact-rows';
import { TREE_ARTIFACT_ICON_CLASS, TREE_ARTIFACT_ICON_TONE_CLASS } from '../ObjectsPanel/tree-classes';
import { cn } from '@heroui/react';

import type { AnalysisExpectedArtifact } from '@volt/contracts/modules/analysis/domain';

interface PendingArtifactRowProps {
    artifact?: AnalysisExpectedArtifact;
    fallbackName: string;
    isRecentlyReady: boolean;
}

/**
 * Row for an artifact the analysis promised but whose exposure has not loaded
 * yet, so there is nothing selectable to render.
 */
const PendingArtifactRow = ({ artifact, fallbackName, isRecentlyReady }: PendingArtifactRowProps) => {
    const status = artifact?.status ?? 'pending';

    return (
        <CanvasTreeRow
            indent='lg'
            disabled
            icon={(
                <span
                    className={cn(TREE_ARTIFACT_ICON_CLASS, status !== 'pending' && TREE_ARTIFACT_ICON_TONE_CLASS[status])}
                    title={status}
                >
                    {getArtifactIcon(status)}
                </span>
            )}
            label={(
                <span className={buildArtifactNameClassName(artifact, isRecentlyReady)}>
                    <span className='truncate'>{artifact?.name ?? fallbackName}</span>
                </span>
            )}
        />
    );
};

export default PendingArtifactRow;
