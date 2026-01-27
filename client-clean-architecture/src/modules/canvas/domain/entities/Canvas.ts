export type Pos3D = {
    x: number;
    y: number;
    z: number;
};

export interface DeviceHardwareInfo {
    memory?: number;
    cores?: number;
    gpu?: string;
}

export interface CanvasSettings {
    showGrid: boolean;
    showAxes: boolean;
    backgroundColor: string;
}
