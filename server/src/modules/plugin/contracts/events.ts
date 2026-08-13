import type Workflow from '@modules/plugin/models/plugin/workflow/Workflow';

export interface PluginCreatedEventPayload{
    pluginId: string;
    teamId: string;
}

export interface PluginDeletedEventPayload{
    pluginId: string;
    teamId: string;
    workflow: Workflow;
}

export interface PluginPublishedEventPayload{
    pluginId: string;
    teamId: string;
    binaryObjectPath?: string;
    requirementsFile?: string;
    entrypointScript?: string;
    binaryHash?: string;
}

/**
 * Carries no analysis ids on purpose. A subscriber that wants the results this run
 * produced must resolve them from `Analysis.pipelineRunId`, which is the only place
 * that distinguishes an analysis the run *computed* from one it merely replayed out
 * of the cache — the run's own stage list holds both kinds of id.
 */
export interface PipelineRunDeletedEventPayload{
    pipelineRunId: string;
    trajectoryId: string;
    teamId: string;
    userId?: string;
}

export interface PluginExecutionRequestPayload{
    pluginId: string;
    trajectoryId: string;
    userId: string;
    pluginName: string;
    teamId: string;
    trajectoryName: string;
}
