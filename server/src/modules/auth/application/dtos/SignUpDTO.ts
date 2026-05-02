import type { PersistedUserDTO } from '@modules/auth/application/dtos/PersistedUserDTO';

export interface SignUpInputDTO{
    email: string;
    firstName: string;
    lastName: string;
    password: string;
    ip: string;
    userAgent: string;
}

export interface SignUpOutputDTO{
    token: string;
    user: PersistedUserDTO
}
