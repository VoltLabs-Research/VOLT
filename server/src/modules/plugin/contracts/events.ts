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

export interface PluginExecutionRequestPayload{
    pluginId: string;
    trajectoryId: string;
    userId: string;
    pluginName: string;
    teamId: string;
    trajectoryName: string;
}
