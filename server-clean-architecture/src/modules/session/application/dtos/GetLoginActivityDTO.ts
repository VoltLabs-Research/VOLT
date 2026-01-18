import Session, { SessionProps } from "../../domain/entities/Session";

export interface GetLoginActivityInputDTO{
    userId: string;
    limit: number;
};

export interface GetLoginActivityOutputDTO{
    activites: SessionProps[],
    total: number;
};