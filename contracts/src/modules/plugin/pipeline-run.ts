import type { BaseEntity, Ref } from '../../shared/base';
import type { User } from '../auth/domain';
import type { PipelineStageKind } from './http';

/**
 * One stage of an executed pipeline, in submission order.
 *
 * A `plugin` stage resolves to exactly one of `analysisId` (it computed) or
 * `cachedFromAnalysisId` (an identical stage had already run, so the daemon
 * replayed that analysis' output instead). Non-plugin stages (`slice`,
 * `expression`) never produce an analysis: they only transform the dump that
 * later stages read, which is why they exist here at all — without them a run
 * cannot explain how its results were obtained.
 */
export interface PipelineRunStage{
    index: number;
    kind: PipelineStageKind;
    pluginId?: string;
    pluginDisplayName?: string;
    config: Record<string, unknown>;
    analysisId?: string;
    cachedFromAnalysisId?: string;
    cacheHit: boolean;
}

export interface PipelineRun extends BaseEntity{
    trajectory: string;
    team: string;
    createdBy?: Ref<User>;
    computeClusterId?: string | null;
    storageClusterId?: string | null;
    selectedTimesteps: number[];
    stages: PipelineRunStage[];
}
