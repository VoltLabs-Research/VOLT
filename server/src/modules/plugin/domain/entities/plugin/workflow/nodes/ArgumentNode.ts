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
};

export interface ArgumentsNodeData{
    arguments: ArgumentDefinition[];
};
