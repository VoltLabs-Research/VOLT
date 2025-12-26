export enum NodeType {
    MODIFIER = 'modifier',
    ARGUMENTS = 'arguments',
    CONTEXT = 'context',
    FOREACH = 'forEach',
    ENTRYPOINT = 'entrypoint',
    EXPOSURE = 'exposure',
    SCHEMA = 'schema',
    VISUALIZERS = 'visualizers',
    EXPORT = 'export',
    IF_STATEMENT = 'if-statement'
};

export enum ArgumentType {
    SELECT = 'select',
    NUMBER = 'number',
    FRAME = 'frame',
    BOOLEAN = 'boolean',
    STRING = 'string'
};

export enum ModifierContext {
    TRAJECTORY_DUMPS = 'trajectory_dumps'
};

export enum Exporter {
    ATOMISTIC = 'AtomisticExporter',
    MESH = 'MeshExporter',
    DISLOCATION = 'DislocationExporter'
};

export enum ExportType {
    GLB = 'glb'
};

export enum PluginStatus {
    DRAFT = 'draft',
    PUBLISHED = 'published',
    DISABLED = 'disabled'
};

export interface IArgumentOption {
    key: string;
    label: string;
};

export interface IArgumentDefinition {
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
};

export interface IForEachData {
    iterableSource: string;
};

export interface IEntrypointData {
    binary: string;
    binaryObjectPath?: string;
    binaryFileName?: string;
    binaryHash?: string;
    arguments: string;
    timeout?: number;
};

export interface IExposureData {
    name: string;
    icon?: string;
    results: string;
    iterable?: string;
    iterableChunkSize?: number;
};

export interface ISchemaData {
    definition: Record<string, any>;
};

export interface IVisualizersData {
    canvas?: boolean;
    raster?: boolean;
    listingTitle?: string;
    listing?: Record<string, string>;
    perAtomProperties?: string[];
};

export interface IExportData {
    exporter: Exporter,
    type: ExportType;
    options?: Record<string, any>;
};

export enum ConditionType {
    AND = 'and',
    OR = 'or'
};

export enum ConditionHandler {
    IS_EQUAL_TO = 'is_equal_to',
    IS_NOT_EQUAL_TO = 'is_not_equal_to'
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
    exposure?: IExposureData;
    schema?: ISchemaData;
    visualizers?: IVisualizersData;
    export?: IExportData;
    ifStatement?: IIfStatementData;
};

export interface IWorkflowNode {
    id: string;
    type: NodeType;
    position: {
        x: number;
        y: number;
    };
    data: INodeData;
};

export interface IWorkflowEdge {
    id: string;
    source: string;
    sourceHandle?: string;
    target: string;
    targetHandle?: string;
};

export interface IWorkflow {
    nodes: IWorkflowNode[];
    edges: IWorkflowEdge[];
    viewport?: {
        x: number;
        y: number;
        zoom: number;
    };
};
