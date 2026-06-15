export enum ArgumentType {
    Select = 'select',
    Number = 'number',
    Frame = 'frame',
    Boolean = 'boolean',
    String = 'string',
    List = 'list',
    Tuple = 'tuple',
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
    optionsFromPluginReference?: string;
    listArguments?: ArgumentDefinition[];
    listItemLabelArgument?: string;
    required?: boolean;
    multipleSelection?: boolean;
    // When true, the argument's value is resolved at pipeline runtime from the
    // shared exposure context (ctx.sharedExposures[argument]) instead of from a
    // user-entered value/default. The daemon injects `--<argument> <path>` and
    // throws if no upstream stage registered that exposure id. The value/default
    // inputs are hidden in the authoring UI when this is set.
    inferFromContext?: boolean;
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
