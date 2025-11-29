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

export interface BoxMetric {
    key: string;
    label: string;
    format?: 'number' | 'percentage' | 'bytes' | 'decimal';
    decimals?: number;
    unit?: string;
    color?: string;
}

export interface RasterConfig {
    component: string;
    title: string;
    showLegend?: boolean;
    legendKey?: string;
    legendColors?: Record<string, string>;
    metrics?: BoxMetric[];
    [key: string]: any; // Allow additional component-specific configuration
}

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
    raster?: boolean | RasterConfig; // Support both old and new schema
    export: ExposureExportConfig;
};

export interface Modifier {
    preset?: Record<string, any>;
    exposure: Record<string, Exposure>;
    analysisSelection?: AnalysisSelectionConfig;
    perFrameListing?: any;
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
};

export type ModifierTransformer = (ctx: ModifierTransformContext) => Promise<any | null> | any | null;