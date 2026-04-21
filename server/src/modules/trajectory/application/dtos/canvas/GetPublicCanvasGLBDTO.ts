import type { Readable } from 'node:stream';
import type { GlbContentEncoding } from '@modules/trajectory/utilities/storage/glb-stream-resolution';

export interface GetPublicCanvasGLBInputDTO {
    trajectoryId: string;
    timestep: string;
    userId?: string;
    acceptEncoding?: string;
};

export interface GetPublicCanvasGLBOutputDTO {
    stream: Readable;
    size?: number;
    objectName: string;
    contentEncoding: GlbContentEncoding;
};
