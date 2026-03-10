import type { WorkflowNodeHandler } from '../services';
import { WorkflowNodeType } from '../contracts';

export class WorkflowContextHandler implements WorkflowNodeHandler {
    readonly type = WorkflowNodeType.Context;
    readonly outputSchema = { properties: {} };

    async execute(_node: any, context: any): Promise<Record<string, unknown>> {
        const current = this.resolveCurrentItem(context);
        const dumps = current ? [current] : [];

        return {
            trajectory_dumps: dumps,
            count: dumps.length,
            trajectory: context.outputs.get(this.findModifierNodeId(context))?.trajectory || null
        };
    }

    private resolveCurrentItem(context: any): Record<string, unknown> | null {
        for (const [, output] of context.outputs.entries()) {
            if (output && typeof output === 'object' && 'currentValue' in output) {
                return (output.currentValue as Record<string, unknown>) || null;
            }
        }

        return null;
    }

    private findModifierNodeId(context: any): string {
        const modifierNode = context.workflow.nodes.find((node: any) => node.type === WorkflowNodeType.Modifier);
        return modifierNode?.id || '';
    }
}
