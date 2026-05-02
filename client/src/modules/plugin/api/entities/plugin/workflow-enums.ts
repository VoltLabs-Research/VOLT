export enum NodeType {
    MODIFIER = 'modifier',
    ARGUMENTS = 'arguments',
    CONTEXT = 'context',
    FOREACH = 'forEach',
    ENTRYPOINT = 'entrypoint',
    PLUGIN = 'plugin-node',
    EXPOSURE = 'exposure',
    EXPORT = 'export',
    IF_STATEMENT = 'if-statement',
    SWITCH_STATEMENT = 'switch-statement',
    SWITCH_CASE = 'switch-case'
}

export enum PluginStatus {
    DRAFT = 'draft',
    PUBLISHED = 'published',
    DISABLED = 'disabled'
}

export enum ArgumentType {
    SELECT = 'select',
    NUMBER = 'number',
    FRAME = 'frame',
    BOOLEAN = 'boolean',
    STRING = 'string',
    LIST = 'list',
    PLUGIN_REFERENCE = 'pluginReference'
}

export enum ArgumentVisibilityOperator {
    EQUALS = 'equals',
    NOT_EQUALS = 'notEquals',
    IN = 'in',
    NOT_IN = 'notIn'
}

export enum ModifierContext {
    TRAJECTORY_DUMPS = 'trajectory_dumps'
}

export enum EntrypointType {
    EXECUTABLE = 'executable',
    PYTHON_SCRIPT = 'python-script',
    PACKAGED_EXECUTABLE = 'packaged-executable'
}

export enum PluginNodeExecutionMode {
    MANUAL = 'manual',
    ARGUMENT_REFERENCE = 'argumentReference'
}

export enum PluginNodeOutputPathMode {
    ISOLATED = 'isolated',
    PARENT = 'parent'
}

export enum Exporter {
    ATOMISTIC = 'AtomisticExporter',
    MESH = 'MeshExporter',
    DISLOCATION = 'DislocationExporter',
    CHART = 'ChartExporter'
}

export enum WorkflowExportType {
    GLB = 'glb',
    CHART_PNG = 'chart-png'
}

export { WorkflowExportType as ExportType_ };

export enum ConditionType {
    AND = 'and',
    OR = 'or'
}

export enum ConditionHandler {
    IS_EQUAL_TO = 'is_equal_to',
    IS_NOT_EQUAL_TO = 'is_not_equal_to'
}
