import type { ArgumentType } from '@modules/plugin/domain/entities/plugin/workflow/nodes/ArgumentNode';

export interface DescribePluginArgumentsInputDTO {
    pluginId: string;
}

export interface DescribedPluginArgumentOption {
    key: string;
    label: string;
}

export interface DescribedPluginArgument {
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
    // True when this argument is NOT user-supplied: its value is injected at
    // pipeline runtime from an upstream stage's shared exposure (the exposure id
    // equals this argument's `key`). Do not put it in the config — instead ensure
    // an earlier pipeline stage produces that exposure id.
    inferFromContext?: boolean;
    note?: string;
}

export interface DescribePluginArgumentsOutputDTO {
    pluginId: string;
    name: string;
    arguments: DescribedPluginArgument[];
}
