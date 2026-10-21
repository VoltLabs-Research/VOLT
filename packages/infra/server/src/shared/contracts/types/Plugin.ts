import type { NodeType } from '@volt/contracts/modules/plugin/enums';

interface WorkflowNodeDataLike {
    exposure?: {
        name?: string;
        results?: string;
    };
}

export interface WorkflowNodeLike {
    id: string;
    type: NodeType;
    position?: {
        x: number;
        y: number;
    };
    data?: WorkflowNodeDataLike;
}

export interface WorkflowPropsLike {
    nodes: WorkflowNodeLike[];
}

interface PluginExposureLike {
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
