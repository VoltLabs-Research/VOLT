import path from 'path';

export interface MeshMaterial {
    baseColor: [number, number, number, number];
    metallic: number;
    roughness: number;
    emissive: [number, number, number];
    doubleSided?: boolean;
}

interface Exporter {
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
        material: MeshMaterial
    ): Buffer;

    generatePointCloudGLB(
        positions: Float32Array,
        colors: Float32Array,
        min: [number, number, number],
        max: [number, number, number]
    ): Buffer;
};

export enum GradientType {
    Viridis = 0,
    Plasma = 1,
    BlueRed = 2,
    Grayscale = 3
};

const nativePath = path.join(process.cwd(), 'native/build/Release/glb_exporter.node');
const exporter: Exporter = require(nativePath);

export default exporter;