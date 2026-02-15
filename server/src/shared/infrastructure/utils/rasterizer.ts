import path from 'path';

interface Rasterizer {
    rasterize(
        glbPath: string,
        pngPath: string,
        width: number,
        height: number,
        az: number,
        el: number,
        opts: { fov: number, distScale: number, zUp: boolean }
    ): boolean;
};

export interface RasterizerOptions {
    inputPath?: string;
    width?: number;
    height?: number;
    fov?: number;
    az?: number;
    el?: number;
    distScale?: number;
    up?: 'z' | 'y';
};

// Adjust path to point to the correct location in the new architecture
// Assuming native folder is in the root of the project, same as package.json
const nativePath = path.resolve(process.cwd(), 'native/build/Release/rasterizer.node');

let rasterizer: Rasterizer;
try {
    rasterizer = require(nativePath);
} catch (error) {
    console.warn(`[Rasterizer] Native module not found at ${nativePath}. Rasterization will fail.`);
}

const rasterize = (glbPath: string, pngPath: string, options: RasterizerOptions = {}): boolean => {
    if (!rasterizer) {
        throw new Error('Native rasterizer module is not loaded.');
    }

    const width = options.width ?? 1600;
    const height = options.height ?? 900;
    const fov = options.fov ?? 45;
    const az = options.az ?? 45;
    const el = options.el ?? 25;
    const distScale = options.distScale ?? 1.0;
    const zUp = options.up === 'z';

    try {
        return rasterizer.rasterize(glbPath, pngPath, width, height, az, el, { fov, distScale, zUp });
    } catch (error: any) {
        console.error('[Rasterizer] Native module threw exception:', error.message || error);
        throw new Error(`Native rasterizer exception: ${error.message || error}`);
    }
};

export default rasterize;
