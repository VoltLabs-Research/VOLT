import { PluginStatus } from '@/models/plugin';

export interface IArgumentOption{
    key: string;
    label: string;
};

export interface IArgumentDefinition{
    argument: string;
    type: ArgumentType;
    label: string;
    default?: any;
    value?: any;
    options?: IArgumentOption[];
    min?: number;
    max?: number;
    step?: number;
};

export interface IModifierData{
    name: string;
    icon?: string;
    author?: string;
    license?: string;
    version?: string;
    homepage?: string;
    description?: string;
};

export interface IArgumentsData{
    arguments: IArgumentDefinition[];
};

export interface IContextData{
    source: ModifierContext;
};

export interface IForEachData{
    iterableSource: string;
};

export interface IEntrypointData{
    binary: string;
    arguments: string;
    timeout?: number;
};

export interface IExposureData{
    name: string;
    results: string;
    iterable?: string;
};

export interface ISchemaData{
    definition: Record<string, any>;
};

export interface IVisualizersData{
    canvas?: boolean;
    raster?: boolean;
    listing?: Record<string, string>;
};

export interface IExportData{
    exporter: Exporter,
    type: ExportType;
    options?: Record<string, any>;
};

export interface INodeData{
    modifier?: IModifierData;
    arguments?: IArgumentsData;
    context?: IContextData;
    forEach?: IForEachData;
    entrypoint?: IEntrypointData;
    exposure?: IExposureData;
    schema?: ISchemaData;
    visualizers?: IVisualizersData;
    export?: IExportData;
};

export interface IWorkflowNode{
    id: string;
    name: string;
    type: NodeType;
    position: {
        x: number;
        y: number;
    };
    data: INodeData;
};

export interface IWorkflowEdge{
    id: string;
    source: string;
    sourceHandle?: string;
    target: string;
    targetHandle?: string;
};

export interface IWorkflow{
    nodes: IWorkflowNode[];
    edges: IWorkflowEdge[];
    viewport?: {
        x: number;
        y: number;
        zoom: number;
    };
};

export interface IPluginModel extends Model<IPlugin>{
    getNodeById(workflow: IWorkflow, nodeId: string): IWorkflowNode | undefined;
    getNodeByName(workflow: IWorkflow, name: string): IWorkflowNode | undefined;
    getChildNodes(workflow: IWorkflow, nodeId: string): IWorkflowNode[];
    getParentNodes(workflow:  IWorkflow, nodeId: string): IWorkflowNode[];
    getNodesByType(workflow: IWorkflow, type:  NodeType): IWorkflowNode[];
};

export interface IPlugin extends Document{
    slug: string;
    workflow: IWorkflow;
    status: PluginStatus;
    validated: boolean;
    validationErrors: string[];
    createdAt: Date;
    updatedAt: Date;
    // Virtuals
    modifier: IModifierData | null;
    name: string;
    version: string;
    exposures: Array<{ nodeId: string; nodeName: string } & IExposureData>;
};
