/**
 * Analysis entity.
 *
 * The shape/props types now live in the neutral contracts layer
 * (`@shared/contracts/types/AnalysisProps`) for the detachable-modules
 * migration. They are re-exported here so existing importers of this module
 * path keep compiling unchanged. The runtime `createAnalysis` factory and the
 * `Analysis` default (type) export remain owned here.
 */
export type {
    AnalysisConfig,
    AnalysisArtifactStatus,
    AnalysisExpectedArtifactStatus,
    AnalysisExpectedArtifact,
    AnalysisStageType,
    AnalysisStageStatus,
    AnalysisStage,
    AnalysisChildAnalysis,
    AnalysisProps,
    Analysis
} from '@shared/contracts/types/AnalysisProps';

import type { Analysis, AnalysisProps } from '@shared/contracts/types/AnalysisProps';

export const createAnalysis = (_id: string, props: AnalysisProps): Analysis => ({
    _id,
    props
});

export default Analysis;
