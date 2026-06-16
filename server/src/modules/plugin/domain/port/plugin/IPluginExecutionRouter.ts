import type Plugin from '@modules/plugin/domain/entities/plugin/Plugin';
import type { Analysis } from '@shared/contracts/types';

export interface PluginReferenceExecutionRequest {
    referencePath: string;
    pluginId: string;
    config: Record<string, unknown>;
}

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
}

export interface PipelineStageExecutionInput {
    kind: 'plugin' | 'slice' | 'expression';
    execution?: RoutePluginExecutionInput;
    cacheHit?: boolean;
    cacheSourceAnalysisId?: string;
    sharedExposureIds?: string[];
    config?: Record<string, unknown>;
}

export interface RoutePipelineExecutionInput {
    teamClusterId: string;
    teamId: string;
    trajectoryId: string;
    trajectoryName: string;
    trajectoryFrames: Array<{ timestep: number; natoms: number; simulationCell: string; }>;
    storageClusterId?: string;
    selectedTimesteps?: number[];
    timestep?: number;
    stages: PipelineStageExecutionInput[];
}

export interface IPluginExecutionRouter {
    routePipeline(input: RoutePipelineExecutionInput): Promise<void>;
}
