import { ErrorCodes } from '@core/constants/error-codes';
import {
    createWorkerFailureEnvelope,
    WorkerFailureError
} from '@shared/infrastructure/workers/WorkerFailureEnvelope';

interface RasterizerNativeOptions {
    fov: number;
    distScale: number;
    zUp: boolean;
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

const rasterize = (glbPath: string, pngPath: string, options: RasterizerOptions = {}): boolean => {
    const requestedOptions: RasterizerNativeOptions = {
        fov: options.fov ?? 45,
        distScale: options.distScale ?? 1.0,
        zUp: options.up === RasterUpAxis.Z
    };

    throw new WorkerFailureError(createWorkerFailureEnvelope({
        code: ErrorCodes.RASTER_WORKER_RENDER_FAILED,
        details: `Rasterization must run through the team cluster daemon: ${JSON.stringify({
            glbPath,
            pngPath,
            width: options.width ?? 1600,
            height: options.height ?? 900,
            az: options.az ?? 45,
            el: options.el ?? 25,
            options: requestedOptions
        })}`
    }));
};

export default rasterize;
