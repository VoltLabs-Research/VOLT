import Session from "../../domain/entities/Session";

export interface GetActiveSessionsInputDTO{
    userId: string;
};

export interface GetActiveSessionsOutputDTO extends Session{}