import type {
    CreateLineStyledModelResult,
    LineStyleSpec
} from '@modules/trajectory/domain/port/line-style/ILineStyleService';
import { Readable } from 'node:stream';

export interface CreateLineStyledModelInputDTO {
    trajectoryId: string;
    timestep: string;
    analysisId: string;
    exposureId: string;
    style?: LineStyleSpec;
};

export type CreateLineStyledModelOutputDTO = CreateLineStyledModelResult;

export interface GetLineStyledModelStreamInputDTO {
    trajectoryId: string;
    timestep: string;
    analysisId: string;
    exposureId: string;
    // JSON-encoded LineStyleSpec — it rides the GLB GET url's query string.
    style?: string;
};

export interface GetLineStyledModelStreamOutputDTO {
    stream: Readable;
};

export interface GetLineModelRangesStreamInputDTO {
    trajectoryId: string;
    timestep: string;
    analysisId: string;
    exposureId: string;
    // JSON-encoded LineStyleSpec; omitted for the exposure's baked GLB.
    style?: string;
};

export interface GetOctreeMetadataStreamInputDTO {
    trajectoryId: string;
    timestep: string;
    analysisId: string;
    exposureId: string;
};

export interface GetLineEntityPropertiesInputDTO {
    trajectoryId: string;
    timestep: string;
    analysisId: string;
    exposureId: string;
    entityId: string;
};

export interface GetLineEntityPropertiesOutputDTO {
    entityId: number;
    properties: Record<string, unknown>;
};
