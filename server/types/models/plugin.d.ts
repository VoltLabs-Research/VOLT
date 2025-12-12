export enum NodeType {
    MODIFIER = 'modifier',
    ARGUMENTS = 'arguments',
    CONTEXT = 'context',
    FOREACH = 'forEach',
    ENTRYPOINT = 'entrypoint',
    EXPOSURE = 'exposure',
    SCHEMA = 'schema',
    VISUALIZERS = 'visualizers',
    EXPORT = 'export'
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