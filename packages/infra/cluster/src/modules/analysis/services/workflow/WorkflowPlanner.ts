import type { WorkflowExecutionContext, WorkflowNodeOutput } from '@shared/contracts/types/workflow.types';
import type { WorkflowNodeExecutor } from '@modules/analysis/services/workflow/WorkflowNodeExecutor';
import { NodeType } from '@volt/contracts/modules/plugin/enums';
import type { IWorkflowNode } from '@volt/contracts/modules/plugin/workflow';

interface WorkflowPlannerExecutedEvent {
    node: IWorkflowNode;
    output: WorkflowNodeOutput;

    startedAt: number;
}

interface WorkflowPlannerSkippedEvent {
    node: IWorkflowNode;
    reason?: string;
    startedAt: number;
}

interface WorkflowPlannerForEachEvent {
    node: IWorkflowNode;
    output: WorkflowNodeOutput;
    items: WorkflowNodeOutput[];
    startedAt: number;
}

interface WorkflowPlannerErrorEvent {
    node: IWorkflowNode;
    error: unknown;
    startedAt: number;
}

interface WorkflowPlannerHooks {

    afterNodeExecuted?: (
        event: WorkflowPlannerExecutedEvent
    ) => WorkflowNodeOutput | void | Promise<WorkflowNodeOutput | void>;

    afterNodeSkipped?: (event: WorkflowPlannerSkippedEvent) => void | Promise<void>;

    onForEach?: (event: WorkflowPlannerForEachEvent) => boolean | void | Promise<boolean | void>;

    onError?: (event: WorkflowPlannerErrorEvent) => void | Promise<void>;
}

interface WorkflowPlanParams {
    nodes: IWorkflowNode[];
    context: WorkflowExecutionContext;
    shouldSkipNode: (node: IWorkflowNode) => boolean;
    hooks?: WorkflowPlannerHooks;
}

interface WorkflowPlannerForEachResult {
    node: IWorkflowNode;
    items: WorkflowNodeOutput[];
}

interface WorkflowPlanningOutcome {

    forEach?: WorkflowPlannerForEachResult;

    contextNodeId?: string;

    haltedEarly: boolean;
}

interface WorkflowForEachItemsOutput extends WorkflowNodeOutput {
    items: WorkflowNodeOutput[];
}

export class WorkflowPlanner {
    constructor(private readonly nodeExecutor: WorkflowNodeExecutor) {}

    async plan(params: WorkflowPlanParams): Promise<WorkflowPlanningOutcome> {
        const { nodes, context, shouldSkipNode, hooks = {} } = params;
        let contextNodeId: string | undefined;
        let forEach: WorkflowPlannerForEachResult | undefined;
        let haltedEarly = false;

        for (const node of nodes) {
            if (shouldSkipNode(node)) {
                continue;
            }

            const startedAt = Date.now();

            try {
                const execution = await this.nodeExecutor.executeNode(node, context);
                if (execution.status === 'skipped') {
                    await hooks.afterNodeSkipped?.({
                        node,
                        reason: execution.reason,
                        startedAt
                    });
                    continue;
                }

                let output = execution.output as WorkflowNodeOutput;
                const transformed = await hooks.afterNodeExecuted?.({
                    node,
                    output,
                    startedAt
                });
                if (transformed !== undefined) {
                    output = transformed;
                }

                if (node.type === NodeType.CONTEXT) {
                    contextNodeId = node.id;
                }

                if (node.type === NodeType.FOREACH) {
                    const items = (output as WorkflowForEachItemsOutput).items;
                    forEach = {
                        node,
                        items
                    };

                    const halt = await hooks.onForEach?.({
                        node,
                        output,
                        items,
                        startedAt
                    });
                    if (halt === true) {
                        haltedEarly = true;
                    }

                    break;
                }
            } catch (error) {
                if (hooks.onError) {
                    await hooks.onError({
                        node,
                        error,
                        startedAt
                    });
                }

                throw error;
            }
        }

        return {
            forEach,
            contextNodeId,
            haltedEarly
        };
    }
}
