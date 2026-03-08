import { Exporter } from '@modules/plugin/domain/entities/plugin/workflow/nodes/ExportNode';
import Plugin from '@modules/plugin/domain/entities/plugin/Plugin';

interface ExposureExportResult {
    exporter: Exporter;
    type: string;
    objectPath?: string;
};

/**
 * Configuration options for the workflow execution context.
 */
interface WorkflowContextOptions{
    selectedFrameOnly?: boolean;
    timestep?: number;
};

/**
 * Represents the outcome of an Exposure node execution.
 * Contains data ready for visualization or export.
 */
export interface ExposureResult{
    exposureName: string;
    nodeId: string;
    data: unknown;
    canvas?: boolean;
    raster?: boolean;
    export?: ExposureExportResult;
};

/**
 * Results of the planning phase.
 * Contains the items that will be iterated over in parallel jobs.
 */
export interface ExecutionPlanResult{
    /** The array of items to process in parallel */
    items: Record<string, unknown>[];
    /** The ID of the ForEach node that generated these items */
    forEachNodeId: string;
};

/**
 * Request object.
 */
export interface WorkflowExecutionRequest{
    plugin: Plugin;
    trajectoryId: string;
    analysisId: string;
    userConfig: Record<string, unknown>;
    teamId: string;
    options?: WorkflowContextOptions;
    currentIterationItem?: Record<string, unknown>;
    currentIterationIndex?: number;
};

/**
 * Debug hooks for step-through workflow execution.
 * Each hook is async to allow the caller to implement pause/gate patterns.
 */
export interface DebugHooks {
    onNodeStart: (nodeId: string, nodeType: string, index: number, total: number) => Promise<void>;
    onNodeCompleted: (nodeId: string, nodeType: string, output: Record<string, unknown>, durationMs: number, index: number, contextSnapshot: Record<string, Record<string, unknown>>) => Promise<void>;
    onNodeSkipped: (nodeId: string, nodeType: string, reason: string) => Promise<void>;
    onNodeError: (nodeId: string, nodeType: string, error: Error) => Promise<void>;
};

export interface IPluginWorkflowEngine{
    planExecutionStrategy(request: WorkflowExecutionRequest): Promise<ExecutionPlanResult | null>;
    executeWorkflowJob(request: WorkflowExecutionRequest, hooks?: DebugHooks): Promise<ExposureResult[]>;
};
