export enum Exporter {
    Atomistic = 'AtomisticExporter',
    Mesh = 'MeshExporter',
    Line = 'LineExporter',
    Chart = 'ChartExporter'
}

export enum ExportType {
    GLB = 'glb',
    ChartPNG = 'chart-png'
}

export interface ExportNodeData {
    exporter: Exporter;
    type: ExportType;
    options?: Record<string, unknown>;
}
