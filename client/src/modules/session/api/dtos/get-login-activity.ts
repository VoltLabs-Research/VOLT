import type { LoginActivityEntry } from '@/modules/session/api/entities/session';

export interface GetLoginActivityOutputDTO {
    activities: LoginActivityEntry[];
    total: number;
};
