import type { PersistedSessionDTO } from '@modules/session/domain/port/ISessionRepository';

export interface GetLoginActivityInputDTO{
    userId: string;
    limit?: number;
};

export interface GetLoginActivityOutputDTO{
    activities: PersistedSessionDTO[];
    total: number;
};
