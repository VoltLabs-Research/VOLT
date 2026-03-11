import type { Readable } from 'node:stream';

export interface GetWhiteboardAssetInputDTO {
    teamId: string;
    whiteboardId: string;
    assetId: string;
};

export interface GetWhiteboardAssetOutputDTO {
    stream: Readable;
    mimetype?: string;
};
