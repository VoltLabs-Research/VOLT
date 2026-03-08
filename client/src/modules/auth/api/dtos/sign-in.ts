import type { User } from '@/modules/auth/api/entities/user';

export interface SignInInputDTO {
    email: string;
    password: string;
};

export interface SignInOutputDTO {
    user: User;
    token: string;
};