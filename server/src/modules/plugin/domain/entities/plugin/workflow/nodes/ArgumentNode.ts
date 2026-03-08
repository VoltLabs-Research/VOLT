export enum ArgumentType{
    Select = 'select',
    Number = 'number',
    Frame = 'frame',
    Boolean = 'boolean',
    String = 'string'
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
    min?: number;
    max?: number;
    step?: number;
};

export interface ArgumentsNodeData{
    arguments: ArgumentDefinition[];
};
