import { logger } from '@/core/logger';
import { WorkflowNodeRegistry } from './NodeRegistry';
import { WorkflowGraph, WorkflowNodeType, type WorkflowExecutionContext } from '../contracts';
import type { DaemonAnalysisDocument, NestedPluginDefinition, WorkflowDefinition } from '@/shared/contracts';

export interface WorkflowPlanResult {
    items: Record<string, unknown>[];
    forEachNodeId?: string;
    nodeOutputSnapshots: Record<string, Record<string, unknown>>;
    batchMode?: boolean;
    contextNodeId?: string;
};

const PLANNING_NODE_TYPES = new Set<WorkflowNodeType>([
    WorkflowNodeType.Modifier,
    WorkflowNodeType.Arguments,
    WorkflowNodeType.Context,
    WorkflowNodeType.ForEach,
    WorkflowNodeType.IfStatement
]);

export interface WorkflowExecutionRequest {
    workflow: WorkflowDefinition;
    nestedPlugins?: NestedPluginDefinition[];
    trajectoryId: string;
    trajectoryFrames: Array<{ timestep: number; natoms: number; simulationCell: string; }>;
    analysis: DaemonAnalysisDocument;
    analysisId: string;
    pluginId: string;
    userConfig: Record<string, unknown>;
    teamId: string;
    options?: {
        selectedFrameOnly?: boolean;
        selectedTimesteps?: number[];
        timestep?: number;
    };
};

const buildRuntimeArguments = (request: WorkflowExecutionRequest): Record<string, unknown> => {
    if (!request.options?.selectedTimesteps?.length) {
        return {};
    }

    return {
        selectedTimesteps: request.options.selectedTimesteps.map((timestep) => ({ value: timestep }))
    };
};

export class WorkflowEngine {
    constructor(
        private readonly registry: WorkflowNodeRegistry
    ) {}

    async planExecutionStrategy(request: WorkflowExecutionRequest): Promise<WorkflowPlanResult | null> {
        const context = this.createExecutionContext(request);
        const executionOrder = context.workflow.topologicalSort();
        const hasForEachNode = executionOrder.some((node) => node.type === WorkflowNodeType.ForEach);

        logger.info(`@daemon-workflow-engine: planning execution for plugin "${request.pluginId}" (batchMode=${!hasForEachNode})`);
        let contextNodeId: string | undefined;

        for (const node of executionOrder) {
            if (!PLANNING_NODE_TYPES.has(node.type)) {
                continue;
            }

            await this.registry.execute(node, context);

            if (node.type === WorkflowNodeType.Context) {
                contextNodeId = node.id;
            }

            if (node.type === WorkflowNodeType.ForEach) {
                const output = context.outputs.get(node.id);
                if (output?.items && Array.isArray(output.items)) {
                    const nodeOutputSnapshots: Record<string, Record<string, unknown>> = {};
                    context.outputs.forEach((value, key) => {
                        nodeOutputSnapshots[key] = value;
                    });

                    return {
                        items: output.items as Record<string, unknown>[],
                        forEachNodeId: node.id,
                        nodeOutputSnapshots
                    };
                }
            }
        }

        // Batch mode: no ForEach node — pass all dump URLs as a single batch
        if (!hasForEachNode && contextNodeId) {
            const contextOutput = context.outputs.get(contextNodeId);
            const dumps = Array.isArray(contextOutput?.trajectory_dumps) ? contextOutput.trajectory_dumps : [];
            const allDumpUrls = dumps
                .map((dump: Record<string, unknown>) => typeof dump.path === 'string' ? dump.path : '')
                .filter((url: string) => url.length > 0);

            if (allDumpUrls.length === 0) {
                return null;
            }

            const nodeOutputSnapshots: Record<string, Record<string, unknown>> = {};
            context.outputs.forEach((value, key) => {
                nodeOutputSnapshots[key] = value;
            });

            return {
                items: dumps,
                nodeOutputSnapshots,
                batchMode: true,
                contextNodeId
            };
        }

        return null;
    }

    private createExecutionContext(request: WorkflowExecutionRequest): WorkflowExecutionContext {
        return {
            outputs: new Map(),
            userConfig: request.userConfig,
            runtimeArguments: buildRuntimeArguments(request),
            trajectoryId: request.trajectoryId,
            trajectoryFrames: request.trajectoryFrames,
            analysis: request.analysis,
            analysisId: request.analysisId,
            generatedFiles: [],
            pluginId: request.pluginId,
            teamId: request.teamId,
            selectedFrameOnly: request.options?.selectedFrameOnly,
            selectedTimesteps: request.options?.selectedTimesteps,
            selectedTimestep: request.options?.timestep,
            workflow: new WorkflowGraph(request.workflow),
            nestedWorkflows: new Map((request.nestedPlugins ?? []).map((nestedPlugin) => [nestedPlugin.pluginId, nestedPlugin.workflow]))
        };
    }
}
