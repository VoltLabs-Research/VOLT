import { User } from '../../domain/entities/User';

export interface SignUpInputDTO{
    email: string;
    firstName: string;
    lastName: string;
    password: string;
    passwordConfirm: string;
};

export interface SignUpOutputDTO{
    user: User;
    token: string;
};