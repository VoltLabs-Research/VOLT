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
}

export enum PluginStatus {
    DRAFT = 'draft',
    PUBLISHED = 'published',
    DISABLED = 'disabled'
}

export enum ArgumentType {
    STRING = 'string',
    NUMBER = 'number',
    BOOLEAN = 'boolean',
    SELECT = 'select',
    FRAME = 'frame'
}

export enum ModifierContext {
    TRAJECTORY_DUMPS = 'trajectory_dumps'
}

export enum Exporter {
    ATOMISTIC = 'atomistic',
    MESH = 'mesh',
    DISLOCATION = 'dislocation',
    CHART = 'chart'
}

export enum ExportType {
    GLB = 'glb',
    CHART_PNG = 'chart_png'
}

export interface IWorkflow {
    nodes: any[];
    edges: any[];
    viewport?: any;
}

export interface Plugin {
    _id: string;
    slug: string;
    description?: string;
    workflow: IWorkflow;
    status: PluginStatus;
    team?: string;
    createdAt: string;
    updatedAt: string;
}
