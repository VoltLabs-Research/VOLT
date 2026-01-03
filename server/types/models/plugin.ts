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
    IF_STATEMENT = 'if-statement',
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

export enum PluginStatus {
    DRAFT = 'draft',
    PUBLISHED = 'published',
    DISABLED = 'disabled'
};

export enum ConditionType {
    AND = 'and',
    OR = 'or'
};

export enum ConditionHandler {
    IS_EQUAL_TO = 'is_equal_to',
    IS_NOT_EQUAL_TO = 'is_not_equal_to'
};
