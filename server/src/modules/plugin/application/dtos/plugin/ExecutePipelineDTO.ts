export type PipelineStageKind = 'plugin' | 'slice' | 'expression';

export interface PipelineStageInput {
    kind: PipelineStageKind;
    // Present for plugin stages only.
    pluginId?: string;
    // Plugin stage: the user argValues. Slice/expression stage: the transform
    // config (clip-plane geometry / boolean expression).
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
    // The analysisId of every COMPUTED plugin stage, in pipeline order. Cache-hit
    // stages reuse a prior analysis and are not re-created, so they are not here.
    analysisIds: string[];
}
