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

export interface GetGlobalAttributesMetadataInputDTO {
    teamId: string;
    analysisId: string;
}

export interface GetGlobalAttributesMetadataOutputDTO {
    attributes: GlobalAttributesMetadataItem[];
}

export interface GetGlobalAttributesTimeSeriesInputDTO {
    teamId: string;
    analysisId: string;
    attribute: string;
    frameStart?: number;
    frameEnd?: number;
}

export interface GetGlobalAttributesTimeSeriesOutputDTO {
    attribute: string;
    unit?: string;
    frames: number[];
    values: number[];
}

export interface ExportGlobalAttributesInputDTO {
    teamId: string;
    analysisId: string;
    format: 'csv';
}
