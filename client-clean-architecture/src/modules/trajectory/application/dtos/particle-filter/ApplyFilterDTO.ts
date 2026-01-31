import type { FilterCondition } from './PreviewFilterDTO';

export type FilterAction = 'delete' | 'highlight';

export interface ApplyFilterInputDTO{
    trajectoryId: string;
    analysisId: string;
    timestep: number;
    conditions: FilterCondition[];
    action: FilterAction;
};

export interface ApplyFilterOutputDTO{
    affectedCount: number;
    success: boolean;
};
