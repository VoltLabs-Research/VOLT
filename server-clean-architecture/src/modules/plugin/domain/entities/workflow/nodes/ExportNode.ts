export enum Exporter{
    Atomistic = 'AtomisticExporter',
    Mesh = 'MeshExporter',
    Dislocation = 'DislocationExporter',
    Chart = 'ChartExporter'
};

export enum ExportType{
    GLB = 'glb',
    ChartPNG = 'chart-png'
};

export interface ExportNodeData{
    exporter: Exporter;
    type: ExportType;
    options?: Record<string, any>;
};
