import type { Readable } from 'node:stream';

export interface GetPublicCanvasGLBInputDTO {
    trajectoryId: string;
    timestep: string;
    userId?: string;
};

export interface GetPublicCanvasGLBOutputDTO {
    stream: Readable;
    size?: number;
    objectName: string;
};
