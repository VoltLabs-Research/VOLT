

import type { IWorkflow } from './workflow';
import type { PluginStatus } from './enums';

export interface ValidateWorkflowInput{
    workflow: IWorkflow;
    pluginId?: string;
}

export interface CreatePluginInput{
    workflow: IWorkflow;
}

export interface UpdatePluginInput{
    workflow?: IWorkflow;
    status?: PluginStatus;
    
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

export type PipelineStageKind = 'plugin' | 'slice' | 'expression';

export interface ExecutePipelineStageInput{
    kind: PipelineStageKind;
    pluginId?: string;
    config: Record<string, unknown>;
}

export interface ExecutePipelineInput{
    teamClusterId?: string;
    selectedTimesteps?: number[];
    timestep?: number;
    stages: ExecutePipelineStageInput[];
}
