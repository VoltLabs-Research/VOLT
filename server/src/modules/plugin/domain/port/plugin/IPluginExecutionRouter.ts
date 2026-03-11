import type Plugin from '@modules/plugin/domain/entities/plugin/Plugin';
import type Analysis from '@modules/analysis/domain/entities/Analysis';

export interface RoutePluginExecutionInput {
    teamClusterId: string;
    analysis: Analysis;
    analysisId: string;
    trajectoryId: string;
    trajectoryFrames: Array<{ timestep: number; natoms: number; simulationCell: string; }>;
    teamId: string;
    plugin: Plugin;
    config: Record<string, unknown>;
    selectedFrameOnly?: boolean;
    timestep?: number;
};

export interface IPluginExecutionRouter {
    route(input: RoutePluginExecutionInput): Promise<void>;
};
