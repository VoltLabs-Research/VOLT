import { BaseEntity } from '@/shared/domain/entities/BaseEntity';

export interface ListingRow extends BaseEntity {
    trajectoryId?: string;
    trajectoryName?: string;
    analysisId?: string;
    exposureId?: string;
    timestep?: number;
    [key: string]: unknown;
};
