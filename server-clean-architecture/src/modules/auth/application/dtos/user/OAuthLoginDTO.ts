import User from "../../../domain/entities/User"

export interface OAuthLoginInputDTO{
    user: User,
    userAgent: string,
    ip: string;
};

export interface OAuthLoginOutputDTO{
    token: string;
};