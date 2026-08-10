import {
    createWorkflowTraceFailure,
    type InlineWorkflowTraceNode,
    type WorkflowTraceCounter
} from '@modules/analysis/services/workflow/WorkflowWalker';

/**
 * Collects the inline trace of a plugin-node execution.
 *
 * Tracing is opt-in — a recorder without a counter is disabled and every append
 * is a no-op, so callers never branch on whether tracing is on. Child recorders
 * are forked so the whole tree shares one id sequence.
 */
export class InlineTraceRecorder {
    readonly nodes: InlineWorkflowTraceNode[] = [];

    constructor(
        private readonly pluginId: string,
        private readonly counter: WorkflowTraceCounter | null
    ) {}

    static enabled(pluginId: string): InlineTraceRecorder {
        return new InlineTraceRecorder(pluginId, { value: 0 });
    }

    static disabled(): InlineTraceRecorder {
        return new InlineTraceRecorder('', null);
    }

    get isEnabled(): boolean {
        return this.counter !== null;
    }

    /** Shared id sequence, so nested traces never collide with their parent's. */
    fork(pluginId: string): InlineTraceRecorder {
        return new InlineTraceRecorder(pluginId, this.counter);
    }

    append(input: Omit<InlineWorkflowTraceNode, 'traceId' | 'pluginId'>): void {
        if (!this.counter) {
            return;
        }

        this.nodes.push({
            traceId: `trace_${++this.counter.value}`,
            pluginId: this.pluginId,
            ...input
        });
    }

    push(nodes: InlineWorkflowTraceNode[]): void {
        this.nodes.push(...nodes);
    }

    /** Wraps a failure so the partial trace survives the throw. */
    failure(message: string, cause: unknown): Error {
        return createWorkflowTraceFailure(message, this.nodes, cause);
    }
}
