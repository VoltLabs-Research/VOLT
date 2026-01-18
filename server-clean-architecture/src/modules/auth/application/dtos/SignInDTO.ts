import { UserProps } from '@modules/auth/domain/entities/User';

export interface SignInInputDTO{
    email: string;
    password: string;
    ip: string;
    userAgent: string;
};

export interface SignInOutputDTO{
    token: string;
    user: UserProps;
};