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

// One ordered stage of a pipeline run. A `plugin` stage that is NOT a cache hit
// carries the same per-plugin dispatch material a single execution would
// (`execution`). A cache-hit plugin stage carries only the reuse pointer. A
// `slice`/`expression` stage carries its dump-transform config.
export interface PipelineStageExecutionInput {
    kind: 'plugin' | 'slice' | 'expression';
    // plugin stages:
    execution?: RoutePluginExecutionInput;
    cacheHit?: boolean;
    cacheSourceAnalysisId?: string;
    // The exposure ids this plugin stage registers into the shared context
    // (so a cache-hit stage can still seed ctx.sharedExposures from the reused
    // analysis without re-running the binary).
    sharedExposureIds?: string[];
    // slice / expression stages:
    config?: Record<string, unknown>;
}

export interface RoutePipelineExecutionInput {
    teamClusterId: string;
    teamId: string;
    trajectoryId: string;
    trajectoryName: string;
    trajectoryFrames: Array<{ timestep: number; natoms: number; simulationCell: string; }>;
    selectedTimesteps?: number[];
    timestep?: number;
    stages: PipelineStageExecutionInput[];
}

export interface IPluginExecutionRouter {
    routePipeline(input: RoutePipelineExecutionInput): Promise<void>;
}
