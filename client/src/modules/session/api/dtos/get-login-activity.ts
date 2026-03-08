import type { LoginActivityEntry } from '@/modules/session/api/entities/session';

export interface GetLoginActivityInputDTO {
    limit?: number;
};

export interface GetLoginActivityOutputDTO {
    activities: LoginActivityEntry[];
    total: number;
};
