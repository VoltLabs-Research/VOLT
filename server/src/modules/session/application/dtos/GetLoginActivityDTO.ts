import Session, { SessionProps } from '@modules/session/domain/entities/Session';

export interface GetLoginActivityInputDTO{
    userId: string;
    limit: number;
};

export interface GetLoginActivityOutputDTO{
    activites: SessionProps[],
    total: number;
};