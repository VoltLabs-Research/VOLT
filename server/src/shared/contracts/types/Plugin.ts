

export enum WorkflowNodeType {
    Modifier = 'modifier',
    Arguments = 'arguments',
    Context = 'context',
    ForEach = 'forEach',
    Entrypoint = 'entrypoint',
    Plugin = 'plugin-node',
    Exposure = 'exposure',
    Export = 'export',
    IfStatement = 'if-statement',
    SwitchStatement = 'switch-statement',
    SwitchCase = 'switch-case'
}

export interface WorkflowNodeDataLike {
    exposure?: {
        name?: string;
        results?: string;
    };
}

export interface WorkflowNodeLike {
    id: string;
    type: WorkflowNodeType;
    position?: {
        x: number;
        y: number;
    };
    data?: WorkflowNodeDataLike;
}

export interface WorkflowPropsLike {
    nodes: WorkflowNodeLike[];
}

export interface PluginExposureLike {
    _id?: string;
    name?: string;
    export?: {
        exporter?: string;
        type?: string;
        options?: Record<string, unknown>;
    } | null;
}

export interface PluginProps {
    team: string;
    status: string;
    workflow: {
        props: WorkflowPropsLike;
    };
    modifier?: {
        name?: string;
    } | null;
    exposures?: PluginExposureLike[];
    createdAt?: Date;
    updatedAt?: Date;
}

export interface PluginLike {
    _id: string;
    props: PluginProps;
}
