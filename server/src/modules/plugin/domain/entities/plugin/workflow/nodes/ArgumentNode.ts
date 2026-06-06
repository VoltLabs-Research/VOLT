export enum ArgumentType {
    Select = 'select',
    Number = 'number',
    Frame = 'frame',
    Boolean = 'boolean',
    String = 'string',
    List = 'list',
    PluginReference = 'pluginReference'
}

export interface ArgumentOption {
    key: string;
    label: string;
}

export interface ArgumentOptionSource {
    argument?: string;
    valueField?: string;
    labelField?: string;
}

export const ArgumentVisibilityOperators = [
    'equals',
    'notEquals',
    'in',
    'notIn'
] as const;

export type ArgumentVisibilityOperator = (typeof ArgumentVisibilityOperators)[number];

export interface ArgumentVisibilityCondition {
    argument: string;
    operator: ArgumentVisibilityOperator;
    value?: string | number | boolean;
    values?: Array<string | number | boolean>;
}

export interface PluginReferenceArgumentMapping {
    sourceArgument: string;
    targetArgument: string;
    targetPluginId?: string;
    targetPluginKey?: string;
    valueMap?: Record<string, unknown>;
}

export interface ArgumentDefinition {
    argument: string;
    type: ArgumentType;
    label: string;
    default?: unknown;
    value?: unknown;
    options?: ArgumentOption[];
    optionsFromArguments?: ArgumentOptionSource[];
    listArguments?: ArgumentDefinition[];
    listItemLabelArgument?: string;
    required?: boolean;
    multipleSelection?: boolean;
    pluginReferenceFilter?: string[];
    pluginReferenceFilterKeys?: string[];
    showPluginConfiguration?: boolean;
    pluginReferenceMappings?: PluginReferenceArgumentMapping[];
    min?: number;
    max?: number;
    step?: number;
    visibleWhen?: ArgumentVisibilityCondition;
}

export interface ArgumentsNodeData {
    arguments: ArgumentDefinition[];
}
