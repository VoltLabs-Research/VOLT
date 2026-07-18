import { Readable } from 'node:stream';

import type {
    LineStyleParams,
    TrajectoryNativeLineModelResponse
} from '@modules/trajectory/contracts/native';

export type LineStyleSpec = LineStyleParams;

export interface CreateLineStyledModelResult {
    objectName: string;
    entitiesRendered: number;
    entitiesTotal: number;
    categoryCounts: Record<string, number>;
}

export interface LineStyleStreamResponse {
    stream: Readable;
    contentEncoding?: string;
    contentLength?: number;
}

export type LineModelDaemonResponse = TrajectoryNativeLineModelResponse;

export interface ILineStyleService {
    createStyledModel(
        trajectoryId: string,
        timestep: string | number,
        analysisId: string,
        exposureId: string,
        style: LineStyleSpec
    ): Promise<CreateLineStyledModelResult>;

    getModelStreamResponse(
        trajectoryId: string,
        timestep: string | number,
        analysisId: string,
        exposureId: string,
        style: LineStyleSpec
    ): Promise<LineStyleStreamResponse>;

    getRangesStreamResponse(
        trajectoryId: string,
        timestep: string | number,
        analysisId: string,
        exposureId: string,
        style?: LineStyleSpec
    ): Promise<LineStyleStreamResponse>;

    getOctreeMetadataStreamResponse(
        trajectoryId: string,
        timestep: string | number,
        analysisId: string,
        exposureId: string
    ): Promise<LineStyleStreamResponse>;
}
