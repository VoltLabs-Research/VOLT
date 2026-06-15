import { createService, get, download } from '@/app/core/http/utilities/create-service';

export interface GlobalAttributesMetadataItem {
    name: string;
    unit?: string;
    pluginKey: string;
    exposureName: string;
    min: number;
    max: number;
    mean: number;
    count: number;
}

export interface GlobalAttributesMetadataResponse {
    attributes: GlobalAttributesMetadataItem[];
}

export interface GlobalAttributesTimeSeriesParams {
    analysisId: string;
    attribute: string;
    frameStart?: number;
    frameEnd?: number;
}

export interface GlobalAttributesTimeSeriesResponse {
    attribute: string;
    unit?: string;
    frames: number[];
    values: number[];
}

export interface GetGlobalAttributesMetadataParams {
    analysisId: string;
}

export interface ExportGlobalAttributesParams {
    analysisId: string;
}

const endpoints = {
    getMetadata: get<GetGlobalAttributesMetadataParams, GlobalAttributesMetadataResponse>(
        '/:analysisId/global-attributes/metadata'
    ),
    getTimeSeries: get<GlobalAttributesTimeSeriesParams, GlobalAttributesTimeSeriesResponse>(
        '/:analysisId/global-attributes/timeseries'
    ),
    exportCsv: download<ExportGlobalAttributesParams>(
        'GET',
        '/:analysisId/global-attributes/export'
    )
};

export default createService({
    clients: {
        default: {
            basePath: '/analyses',
            useRBAC: true
        }
    }
}, endpoints);
