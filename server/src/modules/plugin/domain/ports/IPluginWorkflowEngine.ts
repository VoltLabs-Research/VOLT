import Plugin from '@modules/plugin/domain/entities/Plugin';
import { Exporter } from '@modules/plugin/domain/entities/workflow/nodes/ExportNode';

/**
 * Configuration options for the workflow execution context.
 */
export interface WorkflowContextOptions{
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
    data: any;
    schema?: Record<string, any>;
    visualizers?: {
        canvas: boolean;
        raster?: boolean;
        listing?: Record<string, string>;
    };
    export?: {
        exporter: Exporter;
        type: string;
        objectPath?: string;
    };
};

/**
 * Results of the planning phase.
 * Contains the items that will be iterated over in parallel jobs.
 */
export interface ExecutionPlanResult{
    /** The array of items to process in parallel */
    items: any[];
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
    userConfig: Record<string, any>;
    teamId: string;
    options?: WorkflowContextOptions;
    currentIterationItem?: any;
    currentIterationIndex?: number;
};

export interface IPluginWorkflowEngine{
    /**
     * Executes the workflow only up to the "ForEach" node.
     * This determines how many parallel jobs need to be spawned (e.g., 100 frames = 100 jobs).
     */
    planExecutionStrategy(request: WorkflowExecutionRequest): Promise<ExecutionPlanResult | null>;

    /**
     * Executes the full workflow for a single item from the planning phase.
     */
    executeWorkflowJob(request: WorkflowExecutionRequest): Promise<ExposureResult[]>;
};