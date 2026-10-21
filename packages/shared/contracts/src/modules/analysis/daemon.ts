import type { IWorkflow } from '../plugin/workflow';
import type { PipelineStageKind } from '../plugin/http';
import type { QueuedAnalysisJobNotification } from '../cluster/daemon-events';

// Payloads of the analysis and pipeline commands in DaemonCommand.

export interface TrajectoryFrame{
    timestep: number;
    natoms: number;
    simulationCell: string;
}

// A plugin the dispatched workflow references, shipped with its own workflow.
export interface NestedPluginDefinition{
    pluginId: string;
    workflow: IWorkflow;
}

// One plugin a pluginReference argument selected, with its config after mappings.
export interface PluginReferenceExecutionRequest{
    referencePath: string;
    pluginId: string;
    config: Record<string, unknown>;
}

// The analysis document as the daemon sees it; dates arrive serialized.
export interface DaemonAnalysisDocument{
    _id: string;
    plugin?: string;
    pluginDisplayName: string;
    computeClusterId?: string;
    storageClusterId?: string;
    config?: Record<string, unknown>;
    trajectory?: string;
    createdBy?: string;
    totalFrames?: number;
    completedFrames?: number;
    startedAt?: string | Date;
    finishedAt?: string | Date;
    team?: string;
    status?: string;
    createdAt?: string | Date;
    updatedAt?: string | Date;
}

// The large members travel compressed; the daemon decodes them into AnalysisStartRequest.
export interface AnalysisStartTransportRequest{
    analysis: DaemonAnalysisDocument;
    analysisId: string;
    pluginId: string;
    pluginDisplayName: string;
    teamId: string;
    teamClusterId: string;
    trajectoryId: string;
    trajectoryFramesCompressed: string;
    workflowCompressed: string;
    nestedPluginsCompressed: string;
    pluginReferenceExecutionsCompressed: string;
    config: Record<string, unknown>;
    selectedFrameOnly?: boolean;
    selectedTimesteps?: number[];
    timestep?: number;
}

export interface AnalysisStartRequest extends AnalysisStartTransportRequest{
    trajectoryFrames: TrajectoryFrame[];
    workflow: IWorkflow;
    nestedPlugins: NestedPluginDefinition[];
    pluginReferenceExecutions: PluginReferenceExecutionRequest[];
}

export interface AnalysisStartResponse{
    queued: boolean;
    totalJobs: number;
    jobs: QueuedAnalysisJobNotification[];
}

interface PipelineStage<TPlugin>{
    kind: PipelineStageKind;
    plugin?: TPlugin;
    cacheHit?: boolean;
    cacheSourceAnalysisId?: string;
    sharedExposureIds?: string[];
    config?: Record<string, unknown>;
}

export type PipelineStageTransport = PipelineStage<AnalysisStartTransportRequest>;
export type PipelineStartResolvedStage = PipelineStage<AnalysisStartRequest>;

export interface PipelineStartTransportRequest{
    teamId: string;
    teamClusterId: string;
    trajectoryId: string;
    storageClusterId?: string;
    selectedTimesteps?: number[];
    timestep?: number;
    stages: PipelineStageTransport[];
}

export interface PipelineStartRequest extends Omit<PipelineStartTransportRequest, 'stages'>{
    stages: PipelineStartResolvedStage[];
}

export interface PipelineStartResponse{
    jobs: QueuedAnalysisJobNotification[];
}
