import { WorkflowNodeType } from '@shared/contracts/types/workflow.types';
import type {
    WorkflowExecutionContext,
    WorkflowNode,
    WorkflowNodeOutput
} from '@shared/contracts/types/workflow.types';
import type {
    WorkflowNodeExecutionResult,
    WorkflowNodeExecutor
} from '@modules/analysis/services/workflow/WorkflowNodeExecutor';

export interface WorkflowPlannerExecutedEvent {
    node: WorkflowNode;
    output: WorkflowNodeOutput;

    startedAt: number;
}

export interface WorkflowPlannerSkippedEvent {
    node: WorkflowNode;
    reason?: string;
    startedAt: number;
}

export interface WorkflowPlannerForEachEvent {
    node: WorkflowNode;
    output: WorkflowNodeOutput;
    items: WorkflowNodeOutput[];
    startedAt: number;
}

export interface WorkflowPlannerErrorEvent {
    node: WorkflowNode;
    error: unknown;
    startedAt: number;
}

export interface WorkflowPlannerHooks {

    afterNodeExecuted?: (
        event: WorkflowPlannerExecutedEvent
    ) => WorkflowNodeOutput | void | Promise<WorkflowNodeOutput | void>;

    afterNodeSkipped?: (event: WorkflowPlannerSkippedEvent) => void | Promise<void>;

    onForEach?: (event: WorkflowPlannerForEachEvent) => boolean | void | Promise<boolean | void>;

    onError?: (event: WorkflowPlannerErrorEvent) => void | Promise<void>;
}

export interface WorkflowPlanParams {
    nodes: WorkflowNode[];
    context: WorkflowExecutionContext;
    shouldSkipNode: (node: WorkflowNode) => boolean;
    hooks?: WorkflowPlannerHooks;
}

export interface WorkflowPlannerForEachResult {
    node: WorkflowNode;
    items: WorkflowNodeOutput[];
}

export interface WorkflowPlanningOutcome {

    executed: WorkflowNodeExecutionResult[];

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
        const executed: WorkflowNodeExecutionResult[] = [];
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
                    await hooks.afterNodeSkipped?.({ node, reason: execution.reason, startedAt });
                    continue;
                }

                let output = execution.output as WorkflowNodeOutput;
                const transformed = await hooks.afterNodeExecuted?.({ node, output, startedAt });
                if (transformed !== undefined) {
                    output = transformed;
                }

                executed.push({ node, status: 'executed', output });

                if (node.type === WorkflowNodeType.Context) {
                    contextNodeId = node.id;
                }

                if (node.type === WorkflowNodeType.ForEach) {
                    const items = (output as WorkflowForEachItemsOutput).items;
                    forEach = { node, items };

                    const halt = await hooks.onForEach?.({ node, output, items, startedAt });
                    if (halt === true) {
                        haltedEarly = true;
                    }

                    break;
                }
            } catch (error) {
                if (hooks.onError) {
                    await hooks.onError({ node, error, startedAt });
                }

                throw error;
            }
        }

        return { executed, forEach, contextNodeId, haltedEarly };
    }
}
