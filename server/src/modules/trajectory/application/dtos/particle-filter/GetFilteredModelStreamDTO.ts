import { Readable } from 'node:stream';

export interface GetFilteredModelStreamInputDTO {
    trajectoryId: string;
    timestep: string;
    analysisId?: string;
    exposureId?: string;
    property: string;
    operator: string;
    value: string | number;
    action?: string;
}

export interface GetFilteredModelStreamOutputDTO {
    stream: Readable;
}
