
import { requirePlugin } from '@modules/plugin/services/plugin/PluginQueries';
import {
    ArgumentType,
    type ArgumentDefinition
} from '@modules/plugin/models/plugin/workflow/WorkflowTypes';
import type { PluginRefInput } from '@volt/contracts/modules/plugin/ai-tools';

interface DescribedPluginArgumentOption {
    key: string;
    label: string;
}

interface DescribedPluginArgument {
    key: string;
    type: ArgumentType;
    label: string;
    required: boolean;
    default?: unknown;
    min?: number;
    max?: number;
    step?: number;
    options?: DescribedPluginArgumentOption[];
    multipleSelection?: boolean;
    inferFromContext?: boolean;
    note?: string;
}

interface DescribePluginArgumentsOutput {
    pluginId: string;
    name: string;
    arguments: DescribedPluginArgument[];
}

export default class PluginArgumentDescriber{

    async describePluginArguments(input: PluginRefInput): Promise<DescribePluginArgumentsOutput> {
        const plugin = await requirePlugin(input.pluginId);
        const definitions = plugin.props.arguments ?? [];

        return {
            pluginId: plugin._id,
            name: plugin.props.modifier?.name ?? plugin._id,
            arguments: definitions.map((definition) => this.#describeArgument(definition))
        };
    }

    #describeArgument(definition: ArgumentDefinition): DescribedPluginArgument {
        const described: DescribedPluginArgument = {
            key: definition.argument,
            type: definition.type,
            label: definition.label,
            required: definition.required ?? false
        };

        if (definition.default !== undefined) {
            described.default = definition.default;
        }
        if (definition.min !== undefined) {
            described.min = definition.min;
        }
        if (definition.max !== undefined) {
            described.max = definition.max;
        }
        if (definition.step !== undefined) {
            described.step = definition.step;
        }
        if (definition.options?.length) {
            described.options = definition.options.map((option) => ({
                key: option.key,
                label: option.label
            }));
        }
        if (definition.multipleSelection) {
            described.multipleSelection = true;
        }
        if (definition.inferFromContext === true) {
            described.inferFromContext = true;
        }

        const note = this.#buildArgumentNote(definition);
        if (note) {
            described.note = note;
        }

        return described;
    }

    #buildArgumentNote(definition: ArgumentDefinition): string | undefined {
        const notes: string[] = [];

        if (definition.inferFromContext === true) {
            notes.push(`Do NOT set this in config — its value is injected from an upstream pipeline stage that produces the "${definition.argument}" exposure. Put a stage that produces it earlier in the pipeline.`);
        }
        if (definition.type === ArgumentType.LIST && definition.listArguments?.length) {
            const itemKeys = definition.listArguments.map((item) => item.argument).join(', ');
            notes.push(`List of items; each item has: ${itemKeys}.`);
        }
        if (definition.type === ArgumentType.TUPLE && definition.listArguments?.length) {
            const componentKeys = definition.listArguments.map((item) => item.argument).join(', ');
            notes.push(`Single fixed-shape object with fields: ${componentKeys}.`);
        }
        if (definition.type === ArgumentType.PLUGIN_REFERENCE) {
            notes.push('References another plugin; pass that plugin\'s id/key as the value.');
        }
        if (definition.optionsFromArguments?.length || definition.optionsFromPluginReference) {
            notes.push('Available options depend on other arguments at runtime.');
        }
        if (definition.visibleWhen) {
            notes.push(`Only applies when "${definition.visibleWhen.argument}" ${definition.visibleWhen.operator} its configured value.`);
        }

        return notes.length ? notes.join(' ') : undefined;
    }
}
