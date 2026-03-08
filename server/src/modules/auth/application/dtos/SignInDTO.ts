import { PersistedUserDTO } from '@modules/auth/application/dtos/PersistedUserDTO';

export interface SignInInputDTO{
    email: string;
    password: string;
    ip: string;
    userAgent: string;
};

export interface SignInOutputDTO{
    token: string;
    user: PersistedUserDTO;
};
