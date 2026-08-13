import ObjectsPanel from '../ObjectsPanel';
import { memo } from 'react';
import type { CanvasPanelActionProps } from '../canvas-panel-props';
import type { Trajectory } from '@volt/contracts/modules/trajectory/domain';

interface RightPanelProps extends CanvasPanelActionProps {
    trajectory?: Trajectory | null;
    trajectoryId?: string;
    analysisId?: string;
    currentTimestep?: number;
    canMutateCanvas?: boolean;
    compactAnalysisOnly?: boolean;
}

const RightPanel = ({
    trajectory,
    trajectoryId,
    analysisId,
    currentTimestep,
    canMutateCanvas,
    onDownloadAnalysis,
    onDownloadExposureListing,
    compactAnalysisOnly = false
}: RightPanelProps) => (
    <ObjectsPanel
        trajectory={trajectory}
        trajectoryId={trajectoryId}
        analysisId={analysisId}
        currentTimestep={currentTimestep}
        canMutateCanvas={canMutateCanvas}
        onDownloadAnalysis={onDownloadAnalysis}
        onDownloadExposureListing={onDownloadExposureListing}
        mode={compactAnalysisOnly ? 'analysis-compact' : 'default'}
    />
);

export default memo(RightPanel);
