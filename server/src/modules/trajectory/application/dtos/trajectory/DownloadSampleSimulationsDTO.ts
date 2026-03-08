import type { ReadStream } from 'node:fs';

export interface DownloadSampleSimulationsInputDTO {
    filename?: string;
};

export interface DownloadSampleSimulationsOutputDTO {
    stream: ReadStream;
    filename: string;
};
