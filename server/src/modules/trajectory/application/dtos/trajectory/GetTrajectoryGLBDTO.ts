import type { Readable } from 'node:stream';
import type { GlbContentEncoding } from '@modules/trajectory/utilities/storage/glb-stream-resolution';

export interface GetTrajectoryGLBInputDTO {
    trajectoryId: string;
    timestep: string;
    /**
     * Forwarded from the HTTP request so the storage resolver can pick between
     * passthrough zstd and a server-side re-encode fallback without the
     * downstream use-cases re-parsing the header themselves.
     */
    acceptEncoding?: string;
};

export interface GetTrajectoryGLBOutputDTO {
    stream: Readable;
    size?: number;
    objectName: string;
    contentEncoding: GlbContentEncoding;
};
