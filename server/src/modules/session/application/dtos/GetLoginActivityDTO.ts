import type { PersistedSessionDTO } from '@modules/session/application/dtos/PersistedSessionDTO';

export interface GetLoginActivityInputDTO {
    userId: string;
    limit?: number;
};

export interface GetLoginActivityOutputDTO {
    activities: PersistedSessionDTO[];
    total: number;
};
