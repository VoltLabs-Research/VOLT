import { ErrorCodes } from '@core/constants/error-codes';
import logger from '@shared/infrastructure/logger';
import {
    createWorkerFailureEnvelope,
    WorkerFailureError
} from '@shared/infrastructure/workers/WorkerFailureEnvelope';
import path from 'path';

interface RasterizerNativeOptions {
    fov: number;
    distScale: number;
    zUp: boolean;
};

interface Rasterizer {
    rasterize(
        glbPath: string,
        pngPath: string,
        width: number,
        height: number,
        az: number,
        el: number,
        opts: RasterizerNativeOptions
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
    up?: RasterUpAxis;
};

export enum RasterUpAxis {
    Z = 'z',
    Y = 'y'
};

const nativePath = path.resolve(process.cwd(), 'native/build/Release/rasterizer.node');

const resolveErrorMessage = (error: unknown): string => {
    if (error instanceof Error && error.message.trim()) {
        return error.message;
    }

    if (typeof error === 'string' && error.trim()) {
        return error;
    }

    return 'Native rasterization failed';
};

let rasterizer: Rasterizer | null = null;
try {
    rasterizer = require(nativePath);
} catch (error) {
    logger.warn(`[Rasterizer] Native module not found at ${nativePath}. Rasterization will fail.`);
}

const rasterize = (glbPath: string, pngPath: string, options: RasterizerOptions = {}): boolean => {
    if (!rasterizer) {
        throw new WorkerFailureError(createWorkerFailureEnvelope({
            code: ErrorCodes.RASTER_WORKER_RENDER_FAILED,
            details: 'Native rasterizer module is not loaded.'
        }));
    }

    const width = options.width ?? 1600;
    const height = options.height ?? 900;
    const fov = options.fov ?? 45;
    const az = options.az ?? 45;
    const el = options.el ?? 25;
    const distScale = options.distScale ?? 1.0;
    const zUp = options.up === RasterUpAxis.Z;

    try {
        return rasterizer.rasterize(glbPath, pngPath, width, height, az, el, { fov, distScale, zUp });
    } catch (error: unknown) {
        const errorMessage = resolveErrorMessage(error);
        logger.error({ err: error }, `[Rasterizer] Native module threw exception: ${errorMessage}`);
        throw new WorkerFailureError(createWorkerFailureEnvelope({
            code: ErrorCodes.RASTER_WORKER_RENDER_FAILED,
            details: `Native rasterizer exception: ${errorMessage}`
        }));
    }
};

export default rasterize;
