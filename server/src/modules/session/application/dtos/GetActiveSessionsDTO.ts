import type { PersistedSessionDTO } from '@modules/session/application/dtos/PersistedSessionDTO';

export interface GetActiveSessionsInputDTO {
    userId: string;
}

export interface GetActiveSessionsOutputDTO extends PersistedSessionDTO {
}
