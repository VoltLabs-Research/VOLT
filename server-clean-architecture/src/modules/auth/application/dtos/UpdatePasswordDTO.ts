import User, { UserProps } from "../../domain/entities/User";

export interface UpdatePasswordInputDTO{
    user: User;
    passwordCurrent: string,
    password: string;
    userAgent: string;
    ip: string;
};

export interface UpdatePasswordOutputDTO{
    token: string;
    user: UserProps;
};