export interface FilterCondition{
    property: string;
    operator: 'eq' | 'ne' | 'gt' | 'lt' | 'gte' | 'lte' | 'in' | 'nin';
    value: unknown;
    exposureId?: string;
};

export interface PreviewFilterInputDTO{
    trajectoryId: string;
    analysisId?: string;
    timestep: number;
    conditions: FilterCondition[];
};

export interface PreviewFilterOutputDTO{
    matchCount: number;
    totalCount: number;
};
