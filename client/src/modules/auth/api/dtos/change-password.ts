import type { User } from '@/modules/auth/api/entities/user';

export interface ChangePasswordInputDTO {
    passwordCurrent?: string;
    password: string;
};

export interface ChangePasswordOutputDTO {
    token: string;
    user: User;
};