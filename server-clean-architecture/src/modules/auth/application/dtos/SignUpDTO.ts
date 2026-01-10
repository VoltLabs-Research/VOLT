import { UserProps } from "../../domain/entities/User";

export interface SignUpInputDTO{
    email: string;
    firstName: string;
    lastName: string;
    password: string;
    ip: string;
    userAgent: string;
};

export interface SignUpOutputDTO{
    token: string;
    user: UserProps
};