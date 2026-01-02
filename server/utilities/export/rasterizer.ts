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

const nativePath = path.join(process.cwd(), 'native/build/Release/rasterizer.node');
const rasterizer: Rasterizer = require(nativePath);

const rasterize = (glbPath: string, pngPath: string, options: RasterizerOptions = {}): boolean => {
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