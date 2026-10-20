import type { BaseEntity, Ref } from '../../shared/base';
import type { User } from '../auth/domain';
import type { PipelineStageKind } from './http';

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
    name?: string | null;
    trajectory: string;
    team: string;
    createdBy?: Ref<User>;
    computeClusterId?: string | null;
    storageClusterId?: string | null;
    selectedTimesteps: number[];
    stages: PipelineRunStage[];
}
