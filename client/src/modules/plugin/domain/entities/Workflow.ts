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

export enum PluginStatus {
    DRAFT = 'draft',
    PUBLISHED = 'published',
    DISABLED = 'disabled'
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
    DISLOCATION = 'DislocationExporter',
    CHART = 'ChartExporter'
};

export enum ExportType {
    GLB = 'glb',
    CHART_PNG = 'chart-png'
};

export enum ChartType {
    LINE = 'line',
    BAR = 'bar',
    SCATTER = 'scatter',
    AREA = 'area'
};

export enum ConditionType {
    AND = 'and',
    OR = 'or'
};

export enum ConditionHandler {
    IS_EQUAL_TO = 'is_equal_to',
    IS_NOT_EQUAL_TO = 'is_not_equal_to'
};

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
    arguments: string;
    timeout?: number;
};

export interface IExposureData {
    name: string;
    icon?: string;
    results: string;
    iterable?: string;
    iterableChunkSize?: number;
    [key: string]: unknown;
};

export interface ISchemaData {
    definition: Record<string, unknown>;
};

export interface IVisualizersData {
    canvas?: boolean;
    raster?: boolean;
    listingTitle?: string;
};

export interface IChartExportOptions {
    xAxisKey: string;
    yAxisKey: string;
    chartType: ChartType;
    title?: string;
    xAxisLabel?: string;
    yAxisLabel?: string;
    width?: number;
    height?: number;
    backgroundColor?: string;
    lineColor?: string;
    fillColor?: string;
    showGrid?: boolean;
    showLegend?: boolean;
};

export interface IExportData {
    exporter: Exporter;
    type: ExportType;
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
    exposure?: IExposureData;
    schema?: ISchemaData;
    visualizers?: IVisualizersData;
    export?: IExportData;
    ifStatement?: IIfStatementData;
    [key: string]: unknown;
};
