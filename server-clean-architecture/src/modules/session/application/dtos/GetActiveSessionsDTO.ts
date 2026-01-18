import Session, { SessionProps } from "../../domain/entities/Session";

export interface GetActiveSessionsInputDTO{
    userId: string;
};

// TODO: SessionProp[]
export interface GetActiveSessionsOutputDTO extends SessionProps{}