// Canonical analysis frame-log snapshot types now live in the neutral contracts
// layer (detachable-modules migration); imported for local use + re-exported for
// owner consumers.
import type { AnalysisFrameLogSnapshot } from '@shared/contracts/types/AnalysisFrameLog';
export type {
    AnalysisFrameLogStatus,
    AnalysisExecutionLogSegment,
    AnalysisFrameLogSnapshot
} from '@shared/contracts/types/AnalysisFrameLog';

export interface GetFrameLogInput {
    analysisId: string;
    teamId: string;
    trajectoryId: string;
    timestep: number;
    afterCursor?: string;
}

export interface IAnalysisExecutionLogService {
    getFrameLog(input: GetFrameLogInput): Promise<AnalysisFrameLogSnapshot>;
    clearRuntimeState(analysisId: string): Promise<void>;
}
