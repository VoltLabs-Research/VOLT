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
    note?: string;
}

export interface DescribePluginArgumentsOutputDTO {
    pluginId: string;
    name: string;
    arguments: DescribedPluginArgument[];
}
