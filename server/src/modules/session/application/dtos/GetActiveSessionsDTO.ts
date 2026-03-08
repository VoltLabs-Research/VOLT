import type { PersistedSessionDTO } from '@modules/session/domain/port/ISessionRepository';

export interface GetActiveSessionsInputDTO{
    userId: string;
};

export interface GetActiveSessionsOutputDTO extends PersistedSessionDTO{}
