import { gzipSync, gunzipSync } from 'node:zlib';

import type {
    DislocationExportData,
    DislocationExportOptions
} from '@/modules/plugin/application/exports/export-node-processor-types';

export const DISLOCATION_SCENE_SOURCE_VERSION = 1;

// Raw dislocation segments persisted next to the baked GLB so styled re-exports
// (family visibility, colors, tube width) never require re-running the analysis.
export interface DislocationSceneSource {
    version: number;
    exporter: 'DislocationExporter';
    options: DislocationExportOptions;
    data: DislocationExportData;
}

export const buildDislocationSceneSourceKey = (
    trajectoryId: string,
    analysisId: string,
    timestep: number,
    exposureId: string
): string => {
    return `trajectory-${trajectoryId}/analysis-${analysisId}/scene-sources/${timestep}/${exposureId}.dislocations.json.gz`;
};

export const encodeDislocationSceneSource = (source: DislocationSceneSource): Buffer => {
    return gzipSync(Buffer.from(JSON.stringify(source), 'utf8'));
};

export const decodeDislocationSceneSource = (buffer: Buffer): DislocationSceneSource => {
    return JSON.parse(gunzipSync(buffer).toString('utf8')) as DislocationSceneSource;
};
