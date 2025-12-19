export type BuiltInExports = 'AtomisticExporter' | 'MeshExporter' | 'DislocationExporter' | 'ChartExporter';
export type ArgType = 'select' | 'number' | 'boolean' | 'trajectory-frame';
export interface AnalysisSelectionField {
    path: string;
    label?: string;
    visibleWhen?: Record<string, any>;
};

export interface AnalysisSelectionConfig {
    title?: AnalysisSelectionField[];
    description?: AnalysisSelectionField[];
};

export interface Manifest {
    name: string;
    author: string;
    license: string;
    version: string;
    homepage: string;
    entrypoint: Entrypoint;
    modifiers: Record<string, Modifier>;
    listing?: Record<string, any>;

};

export interface ExposureExportConfig {
    name: BuiltInExports;
    type: string;
    handler?: string;
    options: Record<string, any>;
};

export interface Exposure {
    results: string;
    iterable?: string;
    iterableChunkSize?: number;
    displayName?: string;
    icon?: string;
    canvas?: boolean;
    raster?: boolean;
    export: ExposureExportConfig;
};

export interface Modifier {
    preset?: Record<string, any>;
    exposure: Record<string, Exposure>;
    analysisSelection?: AnalysisSelectionConfig;
};

export interface EntrypointArgument {
    type: ArgType;
    default?: any;
    values?: any;
    min?: number;
    max?: number;
    label?: string;
    step?: number;
    visibleWhen: Record<string, any>;
};

export interface Entrypoint {
    bin: string;
    arguments: Record<string, EntrypointArgument>;
};

export interface ModifierTransformContext {
    pluginName: string;
    trajectoryId: string;
    analysisId: string;
    timestep: number;
    modifier: Modifier;
    filePath: string;
    exposureId: string;
    exposure: Exposure;

    iterateChunks(): AsyncIterable<Buffer>;
    readAllAsBuffer(): Promise<Buffer>;
    writeChunk(chunk: unknown): Promise<void>;
};

export type ModifierTransformer = (ctx: ModifierTransformContext) => Promise<any | null> | any | null;
