import { User } from '../../domain/entities/User';

export interface SignInInputDTO{
    email: string;
    password: string;
};

export interface SignInOutputDTO{
    user: User;
    token: string;
};