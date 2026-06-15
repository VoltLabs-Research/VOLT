import { Readable } from 'node:stream';

import type {
    LineStyleParams,
    TrajectoryNativeLineModelResponse
} from '@modules/trajectory/domain/contracts/native';

// Property-generic styling spec for any LineExporter exposure. Every knob
// names a per-entity property discovered from the exposure's line table —
// no plugin domain (Burgers families, segment lengths, ...) is baked in.
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

    // Triangle-range sidecar of a generated line GLB (`<glb>.ranges.json`).
    // With a style it targets that styled model; without one it targets the
    // exposure's baked GLB. Clients use it to map a picked triangle back to
    // the line entity id.
    getRangesStreamResponse(
        trajectoryId: string,
        timestep: string | number,
        analysisId: string,
        exposureId: string,
        style?: LineStyleSpec
    ): Promise<LineStyleStreamResponse>;

    // LOD octree-metadata sidecar of an exposure's baked point-cloud GLB
    // (`<glb>.octree.json`). The daemon bakes it next to the GLB for clouds above
    // its atom threshold; the client LOD manager reads it to stream only
    // visible-region tiles. Reuses the same exposure GLB resolution + sidecar
    // streaming as the ranges path.
    getOctreeMetadataStreamResponse(
        trajectoryId: string,
        timestep: string | number,
        analysisId: string,
        exposureId: string
    ): Promise<LineStyleStreamResponse>;
}
