import { WorkflowNodeType } from '@/modules/analysis/contracts/workflow.types';
import type {
    WorkflowExecutionContext,
    WorkflowNode,
    WorkflowNodeOutput
} from '@/modules/analysis/contracts/workflow.types';
import type {
    WorkflowNodeExecutionResult,
    WorkflowNodeExecutor
} from '@/modules/analysis/application/workflow/WorkflowNodeExecutor';

/**
 * Single shared planning traversal used by BOTH the root planner
 * ({@link WorkflowEngine.planExecutionStrategy}) and the nested plugin-ref
 * planner (`WorkflowRuntime.executeNestedPluginWorkflow`).
 *
 * It walks the topologically sorted workflow nodes and EXECUTES the
 * planning-phase prefix (Modifier -> Arguments -> Context -> ForEach), stopping
 * once a ForEach node has executed. Everything else is parameterized so the two
 * callers can keep their (deliberately different) special-cases byte-for-byte:
 *
 * - `shouldSkipNode` is the caller-owned **skip-filter**: a node for which it
 *   returns `true` is silently `continue`d (NOT executed, NO hook fired). This
 *   is how each caller chooses which runtime nodes to defer:
 *     • root  -> defers {Plugin, Entrypoint, Exposure, Export} but EXECUTES the
 *                control-flow nodes (If/Switch/SwitchCase) during planning.
 *     • nested -> defers ALL runtime nodes (`!isPlanningNodeType`), including
 *                 control-flow, to the later nested runtime pass.
 *   Realizing the filter as a pre-execution `continue` is equivalent to root's
 *   previous `executeOrdered({ shouldSkipNode })` (skipped results were ignored)
 *   and to nested's previous `if (!isPlanningNodeType) continue`.
 *
 * - The remaining {@link WorkflowPlannerHooks} let the nested caller localize
 *   Context output, append per-node trace nodes, react to ForEach (seed the
 *   current value or early-exit on an empty itemization) and wrap errors. The
 *   root caller passes no hooks and rebuilds its result from the returned
 *   {@link WorkflowPlanningOutcome}.
 */

export interface WorkflowPlannerExecutedEvent {
    node: WorkflowNode;
    output: WorkflowNodeOutput;
    /** `Date.now()` captured immediately before the node executed. */
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
    /**
     * Invoked after a node executes successfully. May return a replacement
     * output (e.g. the nested caller localizes Context output); returning
     * `undefined`/`void` keeps the original output.
     */
    afterNodeExecuted?: (
        event: WorkflowPlannerExecutedEvent
    ) => WorkflowNodeOutput | void | Promise<WorkflowNodeOutput | void>;
    /**
     * Invoked when the executor itself skips a node (e.g. no registered
     * handler). Distinct from the `shouldSkipNode` skip-filter, which never
     * fires a hook.
     */
    afterNodeSkipped?: (event: WorkflowPlannerSkippedEvent) => void | Promise<void>;
    /**
     * Invoked right after a ForEach node executes (and after
     * {@link WorkflowPlannerHooks.afterNodeExecuted}). Return `true` to request
     * an early halt (the nested caller does this when there are no items);
     * traversal always stops after ForEach regardless of the return value.
     */
    onForEach?: (event: WorkflowPlannerForEachEvent) => boolean | void | Promise<boolean | void>;
    /**
     * Invoked inside the per-node try/catch when a node (or any of the hooks
     * above) throws. Expected to throw a (possibly wrapped) error; the planner
     * re-throws the original error after it returns, so a hook that does not
     * throw cannot accidentally swallow the failure.
     */
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
    /** Executed planning nodes, in traversal (topological) order. */
    executed: WorkflowNodeExecutionResult[];
    /** Present iff a ForEach node executed (always the last executed node). */
    forEach?: WorkflowPlannerForEachResult;
    /** Id of the last executed Context node, if any. */
    contextNodeId?: string;
    /** `true` when {@link WorkflowPlannerHooks.onForEach} requested an early halt. */
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
            // Skip-filter: silently defer this node to a later pass. No trace,
            // no hook, no output mutation -- identical to a plain `continue`.
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

                    // Both root and nested stop planning after the ForEach node.
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
