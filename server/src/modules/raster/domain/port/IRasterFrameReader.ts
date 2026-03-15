import type { Readable } from 'node:stream';

export interface RasterFrameResult {
    stream: Readable;
    contentLength?: number;
    contentType: string;
    cacheControl?: string;
    filename?: string;
};

export interface IRasterFrameReader {
    getRasterFramePNG(trajectoryId: string, teamId: string, timestep: number): Promise<RasterFrameResult>;
    getAnalysisRasterFramePNG(
        trajectoryId: string,
        teamId: string,
        analysisId: string,
        timestep: number,
        model: string
    ): Promise<RasterFrameResult>;
};
