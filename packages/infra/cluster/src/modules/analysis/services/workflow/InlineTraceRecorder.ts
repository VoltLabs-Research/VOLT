import {
    createWorkflowTraceFailure,
    type InlineWorkflowTraceNode,
    type WorkflowTraceCounter
} from '@modules/analysis/services/workflow/WorkflowWalker';

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

    failure(message: string, cause: unknown): Error {
        return createWorkflowTraceFailure(message, this.nodes, cause);
    }
}
