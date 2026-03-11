import type { Readable } from 'node:stream';

export interface GetWhiteboardStateInputDTO {
    teamId: string;
    whiteboardId: string;
};

export interface GetWhiteboardStateOutputDTO {
    stream: Readable;
};
