export enum Exporter {
    Atomistic = 'AtomisticExporter',
    Mesh = 'MeshExporter',
    Line = 'LineExporter',
    Chart = 'ChartExporter',
    Bond = 'BondExporter',
    Configuration = 'ConfigurationExporter'
}

export enum ExportType {
    GLB = 'glb',
    ChartPNG = 'chart-png',
    LammpsDump = 'lammps-dump',
    LammpsData = 'lammps-data',
    ExtXYZ = 'extxyz',
    POSCAR = 'poscar',
    CIF = 'cif'
}

export interface ExportNodeData {
    exporter: Exporter;
    type: ExportType;
    options?: Record<string, unknown>;
}
