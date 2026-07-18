export interface SummarizeAnalysisResultInputDTO {
    analysisId: string;
    teamId: string;
    exposureId?: string;
    maxRows?: number;
}

export interface NumericColumnStats {
    kind: 'numeric';
    count: number;
    nullCount: number;
    min: number;
    max: number;
    mean: number;
    stddev: number;
}

export interface CategoricalColumnValue {
    value: string;
    count: number;
}

export interface CategoricalColumnStats {
    kind: 'categorical';
    count: number;
    nullCount: number;
    distinctCount: number;
    topValues: CategoricalColumnValue[];
}

export type ColumnStats = NumericColumnStats | CategoricalColumnStats;

export interface SummarizedColumn {
    name: string;
    stats: ColumnStats;
}

export interface SummarizedExposure {
    exposureId: string;
    exposureName: string;
    rowCount: number;
    columns: SummarizedColumn[];
}

export interface SummarizeAnalysisResultOutputDTO {
    analysisId: string;
    pluginDisplayName: string;
    trajectoryName: string;
    status: string;
    hasResults: boolean;
    rowCount: number;
    sampledRows: number;
    truncated: boolean;
    exposures: SummarizedExposure[];
    note?: string;
}
