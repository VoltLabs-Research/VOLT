import type { Readable } from 'node:stream';

export interface GetTrajectoryGLBInputDTO {
    trajectoryId: string;
    timestep: string;
};

export interface GetTrajectoryGLBOutputDTO {
    stream: Readable;
    size: number;
    objectName: string;
};
