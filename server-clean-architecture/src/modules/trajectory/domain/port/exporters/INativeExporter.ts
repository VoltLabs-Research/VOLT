import { ExportMaterial } from "./ExportMaterial";

interface NativeMaterial extends ExportMaterial{
    doubleSided: boolean;
}

export interface NativeExporter{
    generateGLB(
        positions: Float32Array,
        types: Uint16Array,
        min: [number, number, number],
        max: [number, number, number]
    ): Buffer;

    generateGLBToFile(
        positions: Float32Array,
        types: Uint16Array,
        min: [number, number, number],
        max: [number, number, number],
        outputPath: string
    ): boolean;

    applyPropertyColors(
        values: Float32Array,
        minVal: number,
        maxVal: number,
        gradientType: number
    ): Float32Array;

    taubinSmooth(
        positions: Float32Array,
        indices: Uint32Array,
        iterations: number
    ): boolean;

    generateMeshGLB(
        positions: Float32Array,
        normals: Float32Array,
        indices: Uint16Array | Uint32Array,
        hasColors: boolean,
        colors: Float32Array | null,
        bounds: { minX: number; minY: number; minZ: number; maxX: number; maxY: number; maxZ: number },
        material: NativeMaterial
    ): Buffer;

    generatePointCloudGLB(
        positions: Float32Array,
        colors: Float32Array,
        min: [number, number, number],
        max: [number, number, number]
    ): Buffer;
};