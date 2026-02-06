import Session, { SessionProps } from '@modules/session/domain/entities/Session';

export interface GetActiveSessionsInputDTO{
    userId: string;
};

// TODO: SessionProp[]
export interface GetActiveSessionsOutputDTO extends SessionProps{}