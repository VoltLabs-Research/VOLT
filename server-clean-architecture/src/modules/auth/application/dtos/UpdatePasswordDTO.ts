import { UserProps } from "../../domain/entities/User";

export interface UpdatePasswordInputDTO{
    userId: string;
    passwordCurrent: string,
    password: string;
    userAgent: string;
    ip: string;
};

export interface UpdatePasswordOutputDTO{
    token: string;
    user: UserProps;
};