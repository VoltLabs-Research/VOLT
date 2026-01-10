import Session from "../../../domain/entities/Session";

export interface GetLoginActivityInputDTO{
    userId: string;
    limit: number;
};

export interface GetLoginActivityOutputDTO{
    activites: Session[],
    total: number;
};