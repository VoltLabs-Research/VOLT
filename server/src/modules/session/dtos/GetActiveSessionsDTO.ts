import type { PersistedSessionDTO } from '@modules/session/dtos/PersistedSessionDTO';

export interface GetActiveSessionsInputDTO {
    userId: string;
    token?: string;
}

export type GetActiveSessionsOutputDTO = PersistedSessionDTO;
