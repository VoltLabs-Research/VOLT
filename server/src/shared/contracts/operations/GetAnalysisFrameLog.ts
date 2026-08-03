import type { AnalysisFrameLogSnapshot } from '@shared/contracts/types/AnalysisFrameLog';
import type { GetAnalysisFrameLogInput as WireGetAnalysisFrameLogInput } from '@volt/contracts/modules/analysis/ai-tools';

/** The wire input plus the team scope the server resolves from the request. */
export type GetAnalysisFrameLogInput = WireGetAnalysisFrameLogInput & { teamId: string };

export type GetAnalysisFrameLogOutput = AnalysisFrameLogSnapshot;
