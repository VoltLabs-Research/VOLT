import type {
    NodeType,
    ArgumentType,
    ModifierContext,
    EntrypointType,
    Exporter,
    ExportType_,
    ConditionType,
    ConditionHandler
} from '@/modules/plugin/api/entities/plugin/workflow-enums';

export interface IWorkflow {
    nodes: IWorkflowNode[];
    edges: IWorkflowEdge[];
    viewport?: IViewport;
};

export interface IViewport {
    x: number;
    y: number;
    zoom: number;
};

export interface IWorkflowNode {
    id: string;
    type: NodeType;
    position: IPosition;
    data: INodeData;
};

export interface IPosition {
    x: number;
    y: number;
};

export interface IWorkflowEdge {
    id: string;
    source: string;
    sourceHandle?: string;
    target: string;
    targetHandle?: string;
};

export interface IArgumentOption {
    key: string;
    label: string;
};

export interface IArgumentDefinition {
    argument: string;
    type: ArgumentType;
    label: string;
    default?: unknown;
    value?: unknown;
    options?: IArgumentOption[];
    listArguments?: IArgumentDefinition[];
    pluginReferenceFilter?: string[];
    min?: number;
    max?: number;
    step?: number;
};

export interface IModifierData {
    name: string;
    icon?: string;
    author?: string;
    license?: string;
    version?: string;
    homepage?: string;
    description?: string;
};

export interface IArgumentsData {
    arguments: IArgumentDefinition[];
};

export interface IContextData {
    source: ModifierContext;
    [key: string]: unknown;
};

export interface IForEachData {
    iterableSource: string;
    [key: string]: unknown;
};

export interface IEntrypointData {
    binary: string;
    binaryObjectPath?: string;
    binaryFileName?: string;
    binaryHash?: string;
    type?: EntrypointType;
    arguments: string;
    requirementsFile?: string;
    entrypointScript?: string;
    timeout?: number;
};

export interface IPluginNodeData {
    pluginId?: string;
    selectedTeamClusterId?: string;
    selectedTimesteps?: number[];
    config?: Record<string, unknown>;
};

export interface IExposureData {
    name: string;
    icon?: string;
    results: string;
    canvas?: boolean;
    raster?: boolean;
    iterable?: string;
    iterableChunkSize?: number;
    [key: string]: unknown;
};

export interface IExportData {
    exporter: Exporter;
    type: ExportType_;
    options?: Record<string, unknown>;
};

export interface ICondition {
    type: ConditionType;
    leftExpr: string;
    handler: ConditionHandler;
    rightExpr: string;
};

export interface IIfStatementData {
    conditions: ICondition[];
};

export interface INodeData {
    modifier?: IModifierData;
    arguments?: IArgumentsData;
    context?: IContextData;
    forEach?: IForEachData;
    entrypoint?: IEntrypointData;
    pluginNode?: IPluginNodeData;
    exposure?: IExposureData;
    export?: IExportData;
    ifStatement?: IIfStatementData;
    [key: string]: unknown;
};
