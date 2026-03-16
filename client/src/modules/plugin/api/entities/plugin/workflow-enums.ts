export enum NodeType {
    MODIFIER = 'modifier',
    ARGUMENTS = 'arguments',
    CONTEXT = 'context',
    FOREACH = 'forEach',
    ENTRYPOINT = 'entrypoint',
    EXPOSURE = 'exposure',
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
    STRING = 'string',
    LIST = 'list'
};

export enum ModifierContext {
    TRAJECTORY_DUMPS = 'trajectory_dumps'
};

export enum EntrypointType {
    EXECUTABLE = 'executable',
    PYTHON_SCRIPT = 'python-script'
};

export enum Exporter {
    ATOMISTIC = 'AtomisticExporter',
    MESH = 'MeshExporter',
    DISLOCATION = 'DislocationExporter',
    CHART = 'ChartExporter'
};

export enum WorkflowExportType {
    GLB = 'glb',
    CHART_PNG = 'chart-png'
};

export { WorkflowExportType as ExportType_ };

export enum ConditionType {
    AND = 'and',
    OR = 'or'
};

export enum ConditionHandler {
    IS_EQUAL_TO = 'is_equal_to',
    IS_NOT_EQUAL_TO = 'is_not_equal_to'
};
