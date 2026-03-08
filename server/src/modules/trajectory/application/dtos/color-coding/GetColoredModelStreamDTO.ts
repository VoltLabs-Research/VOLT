import { Readable } from 'node:stream';

export interface GetColoredModelStreamInputDTO {
    trajectoryId: string;
    timestep: string;
    analysisId?: string;
    exposureId?: string;
    property: string;
    startValue: number;
    endValue: number;
    gradient: string;
}

export interface GetColoredModelStreamOutputDTO {
    stream: Readable;
}
