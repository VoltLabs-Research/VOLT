import { Readable } from 'node:stream';

export interface DislocationStyleSpec {
    lineWidth?: number;
    tubularSegments?: number;
    minLength?: number;
    colorMode?: 'family' | 'uniform' | 'property';
    uniformColor?: [number, number, number, number];
    familyColors?: Record<string, [number, number, number, number]>;
    familyVisibility?: Record<string, boolean>;
    property?: 'length' | 'magnitude';
    gradient?: string;
    startValue?: number;
    endValue?: number;
}

export interface CreateDislocationStyledModelResult {
    objectName: string;
    segmentsRendered: number;
    segmentsTotal: number;
    familyCounts: Record<string, { count: number; totalLength: number }>;
}

export interface DislocationStyleStreamResponse {
    stream: Readable;
    contentEncoding?: string;
    contentLength?: number;
}

export interface IDislocationStyleService {
    createStyledModel(
        trajectoryId: string,
        timestep: string | number,
        analysisId: string,
        exposureId: string,
        style: DislocationStyleSpec
    ): Promise<CreateDislocationStyledModelResult>;

    getModelStreamResponse(
        trajectoryId: string,
        timestep: string | number,
        analysisId: string,
        exposureId: string,
        style: DislocationStyleSpec
    ): Promise<DislocationStyleStreamResponse>;
}
