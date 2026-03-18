import type Plugin from '@modules/plugin/domain/entities/plugin/Plugin';
import type Analysis from '@modules/analysis/domain/entities/Analysis';

export interface StorageClusterMinioConfig {
    host: string;
    port: number;
    username: string;
    password: string;
};

export interface PluginReferenceExecutionRequest {
    referencePath: string;
    pluginId: string;
    config: Record<string, unknown>;
};

export interface RoutePluginExecutionInput {
    teamClusterId: string;
    analysis: Analysis;
    analysisId: string;
    pluginDisplayName: string;
    trajectoryId: string;
    trajectoryName: string;
    trajectoryFrames: Array<{ timestep: number; natoms: number; simulationCell: string; }>;
    teamId: string;
    plugin: Plugin;
    pluginDependencies: Plugin[];
    pluginReferenceExecutions: PluginReferenceExecutionRequest[];
    config: Record<string, unknown>;
    selectedFrameOnly?: boolean;
    selectedTimesteps?: number[];
    timestep?: number;
    storageClusterId?: string;
    storageClusterMinioConfig?: StorageClusterMinioConfig;
};

export interface IPluginExecutionRouter {
    route(input: RoutePluginExecutionInput): Promise<void>;
};
