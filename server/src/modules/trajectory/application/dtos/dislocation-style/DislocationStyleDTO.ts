import type {
    CreateDislocationStyledModelResult,
    DislocationStyleSpec
} from '@modules/trajectory/domain/port/dislocation-style/IDislocationStyleService';
import { Readable } from 'node:stream';

export interface CreateDislocationStyledModelInputDTO {
    trajectoryId: string;
    timestep: string;
    analysisId: string;
    exposureId: string;
    style?: DislocationStyleSpec;
};

export type CreateDislocationStyledModelOutputDTO = CreateDislocationStyledModelResult;

export interface GetDislocationStyledModelStreamInputDTO {
    trajectoryId: string;
    timestep: string;
    analysisId: string;
    exposureId: string;
    // JSON-encoded DislocationStyleSpec — it rides the GLB GET url's query string.
    style?: string;
};

export interface GetDislocationStyledModelStreamOutputDTO {
    stream: Readable;
};
