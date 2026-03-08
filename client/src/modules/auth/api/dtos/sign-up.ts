import type { User } from '@/modules/auth/api/entities/user';

export interface SignUpInputDTO {
    email: string;
    firstName: string;
    lastName: string;
    password: string;
    passwordConfirm: string;
};

export interface SignUpOutputDTO {
    user: User;
    token: string;
};