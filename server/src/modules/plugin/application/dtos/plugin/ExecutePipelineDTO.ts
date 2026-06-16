export type PipelineStageKind = 'plugin' | 'slice' | 'expression';

export interface PipelineStageInput {
    kind: PipelineStageKind;
    pluginId?: string;
    config: Record<string, unknown>;
}

export interface ExecutePipelineInputDTO {
    trajectoryId: string;
    userId: string;
    teamId: string;
    teamClusterId?: string;
    selectedTimesteps?: number[];
    timestep?: number;
    stages: PipelineStageInput[];
}

export interface ExecutePipelineOutputDTO {
    analysisIds: string[];
}
