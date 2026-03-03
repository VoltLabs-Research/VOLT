import type { SessionProps } from '@modules/session/domain/entities/Session';

export interface GetActiveSessionsInputDTO{
    userId: string;
};

export interface GetActiveSessionsOutputDTO extends SessionProps{}