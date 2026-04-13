export enum ArgumentType{
    Select = 'select',
    Number = 'number',
    Frame = 'frame',
    Boolean = 'boolean',
    String = 'string',
    List = 'list',
    PluginReference = 'pluginReference'
};

export interface ArgumentOption{
    key: string;
    label: string;
};

export const ArgumentVisibilityOperators = [
    'equals',
    'notEquals',
    'in',
    'notIn'
] as const;

export type ArgumentVisibilityOperator = (typeof ArgumentVisibilityOperators)[number];

export interface ArgumentVisibilityCondition{
    argument: string;
    operator: ArgumentVisibilityOperator;
    value?: string | number | boolean;
    values?: Array<string | number | boolean>;
};

export interface ArgumentDefinition{
    argument: string;
    type: ArgumentType;
    label: string;
    default?: unknown;
    value?: unknown;
    options?: ArgumentOption[];
    listArguments?: ArgumentDefinition[];
    multipleSelection?: boolean;
    pluginReferenceFilter?: string[];
    showPluginConfiguration?: boolean;
    min?: number;
    max?: number;
    step?: number;
    visibleWhen?: ArgumentVisibilityCondition;
};

export interface ArgumentsNodeData{
    arguments: ArgumentDefinition[];
};
