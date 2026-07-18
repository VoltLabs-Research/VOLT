

import type { WorkflowWire } from './domain';

export interface ValidateWorkflowInput{
    workflow: WorkflowWire;
    pluginId?: string;
}

export interface CreatePluginInput{
    workflow: WorkflowWire;
}

export interface UpdatePluginInput{
    workflow?: WorkflowWire;
    status?: 'draft' | 'published' | 'disabled';
    
    _allowBinaryFieldUpdate?: boolean;
}

export interface InstallRegistryPluginInput{
    name: string;
    version?: string;
}

export interface UploadBinaryInput{
    fileName: string;
    size: number;
    type?: string;
    sha256?: string;
}

export interface CommitBinaryUploadInput{
    objectPath: string;
    fileName: string;
    size: number;
    sha256?: string;
}

export interface ExecutePipelineStageInput{
    kind: 'plugin' | 'slice' | 'expression';
    pluginId?: string;
    config: Record<string, unknown>;
}

export interface ExecutePipelineInput{
    teamClusterId?: string;
    selectedTimesteps?: number[];
    timestep?: number;
    stages: ExecutePipelineStageInput[];
}
