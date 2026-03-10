import { logger } from '../../../core/logger';
import { WorkflowNodeRegistry } from './NodeRegistry';
import { WorkflowGraph, WorkflowNodeType, type WorkflowExecutionContext } from '../contracts';
import type { WorkflowDefinition } from '../../../shared/contracts';

export interface WorkflowPlanResult {
    items: Record<string, unknown>[];
    forEachNodeId: string;
    nodeOutputSnapshots: Record<string, Record<string, unknown>>;
}

export interface WorkflowExecutionRequest {
    workflow: WorkflowDefinition;
    trajectoryId: string;
    analysisId: string;
    pluginId: string;
    userConfig: Record<string, unknown>;
    teamId: string;
    options?: {
        selectedFrameOnly?: boolean;
        timestep?: number;
    };
}

export class WorkflowEngine {
    constructor(
        private readonly registry: WorkflowNodeRegistry
    ) {}

    async planExecutionStrategy(request: WorkflowExecutionRequest): Promise<WorkflowPlanResult | null> {
        const context = this.createExecutionContext(request);
        const executionOrder = context.workflow.topologicalSort();

        logger.info(`@daemon-workflow-engine: planning execution for plugin "${request.pluginId}"`);
        for (const node of executionOrder) {
            await this.registry.execute(node, context);
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

        return null;
    }

    private createExecutionContext(request: WorkflowExecutionRequest): WorkflowExecutionContext {
        return {
            outputs: new Map(),
            userConfig: request.userConfig,
            trajectoryId: request.trajectoryId,
            analysisId: request.analysisId,
            generatedFiles: [],
            pluginId: request.pluginId,
            teamId: request.teamId,
            selectedFrameOnly: request.options?.selectedFrameOnly,
            selectedTimestep: request.options?.timestep,
            workflow: new WorkflowGraph(request.workflow)
        };
    }
}
