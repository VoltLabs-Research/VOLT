export type BuiltInExports = 'AtomisticExporter' | 'MeshExporter' | 'DislocationExporter' | 'ChartExporter';

export interface PluginArgument {
    argument: string;
    type: 'select' | 'number' | 'boolean' | 'string' | 'frame';
    label: string;
    default?: any;
    value?: any;
    options?: Array<{ key: string; label: string }>;
    min?: number;
    max?: number;
    step?: number;
}

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
    [key: string]: any;
}

export interface ExportConfig {
    exporter: BuiltInExports;
    type: string;
    options?: Record<string, any>;
}

export interface ExposureData {
    name: string;
    results: string;
    iterable?: string;
    perAtomProperties?: string[];
}

export interface VisualizersData {
    canvas?: boolean;
    raster?: boolean | RasterConfig;
    listingTitle?: string;
    listing?: Record<string, string>;
}