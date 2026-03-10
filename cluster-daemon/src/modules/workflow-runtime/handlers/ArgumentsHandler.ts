import type { WorkflowNodeHandler, WorkflowNodeRegistry } from '../services';
import { WorkflowNodeType } from '../contracts';

export class WorkflowArgumentsHandler implements WorkflowNodeHandler {
    readonly type = WorkflowNodeType.Arguments;
    readonly outputSchema = { properties: {} };

    constructor(
        private readonly registry: WorkflowNodeRegistry
    ) {}

    async execute(node: any, context: any): Promise<Record<string, unknown>> {
        const definitions = Array.isArray(node.data.arguments?.arguments)
            ? node.data.arguments.arguments
            : [];

        const values: Record<string, unknown> = {};
        const cliArgs: string[] = [];

        for (const definition of definitions) {
            let value = definition.value ?? context.userConfig[definition.argument] ?? definition.default;
            if (typeof value === 'string' && value.includes('{{')) {
                value = this.registry.resolveTemplate(value, context);
            }

            values[definition.argument] = value;
            if (value !== null && value !== undefined) {
                if (definition.type === 'boolean') {
                    if (String(value) === 'true') {
                        cliArgs.push(`--${definition.argument}`);
                    }
                } else {
                    cliArgs.push(`--${definition.argument}`, String(value));
                }
            }
        }

        return {
            as_str: cliArgs.join(' '),
            as_array: cliArgs,
            ...values
        };
    }
}
