import type { BaseEntity } from '../../../shared/base';
import type { TeamClusterRole } from '../../cluster/domain';
import type { IWorkflow, IModifierData } from './workflow';
import type { PluginStatus } from './enums';
import type {
    IExposureComputed,
    IComputedArgumentDefinition,
    IListingsWithExposures
} from './exposure';

export interface Plugin extends BaseEntity{
    team?: string;
    teamCluster?: string | null;
    workflow: IWorkflow;
    status: PluginStatus;
    modifier?: IModifierData | null;
    exposures?: IExposureComputed[];
    arguments?: IComputedArgumentDefinition[];
    listingExposures?: IListingsWithExposures | null;
}

export interface PluginTeamClusterOption{
    _id: string;
    name: string;
    roleConfig?: {
        desiredRole: TeamClusterRole;
        effectiveRole: TeamClusterRole;
    };
}

export interface CreatePluginResponse{
    plugin: Plugin;
}

export type GetPluginResponse = Plugin;
export type UpdatePluginResponse = Plugin;
export type InstallRegistryPluginResponse = Plugin;
export type ImportPluginResponse = Plugin;

export interface ClonePluginResponse{
    plugin: Plugin;
}

export interface GetNodeTypesSchemaResponse{
    nodeTypes: Record<string, string[]>;
}

export interface ValidateWorkflowResponse{
    validated: boolean;
    errors?: string[];
    modifier?: Record<string, unknown>;
}

export interface BinaryUploadResult{
    objectPath: string;
    fileName: string;
    size: number;
    binaryHash: string;
}

export interface BinaryUploadTarget extends BinaryUploadResult{
    uploadUrl: string;
    expiresAt: string;
}

export interface ExecutePipelineResponse{
    analysisIds: string[];
}
